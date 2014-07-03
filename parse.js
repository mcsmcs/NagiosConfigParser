'use strict';
/*jslint unparam: true, node: true */

var sys = require('sys');
var exec = require('child_process').exec;
var async = require('async');
var fs = require('fs');
var child;
var i,j,k;

var nagiosCfg = {
	path: 	null,
	main: 	[],
	dirs: 	[],
	files: 	[],
};

var nagiosObj = {
	commands: [],
	contacts: [],
	contactgroups: [],
	hosts: [],
	hostgroups: [],
	hostextinfos: [],
	services: [],
	servicegroups: [],
	timeperiods: [],
};

var detectLinuxDistro = function(callback){
	child = exec("cat /etc/*release | grep -o 'Ubuntu\\|CentOS' | sort -u",
		function(error, stdout, stderr){
			callback(error, stdout.toString().replace(/\n/,''));
		}
	);
};

var detectNagiosCfgDirectives = function(cfgLine){
	if (cfgLine.match(/^cfg_dir=/)){ nagiosCfg.dirs.push(cfgLine.split('=')[1]); }
	else if (cfgLine.match(/^cfg_file=/)){ nagiosCfg.files.push(cfgLine.split('=')[1]); }
};


var walk = function(directory, done){
	var results = [];
	var pendingFiles;

	fs.readdir(directory, function(err, files){
		if(err){ console.log(err); done(err); }
		pendingFiles = files.length;

		files.forEach(function(fileName, index){

			var filePath = directory + '/' + fileName;
			fs.stat(filePath, function(err,stat){

				if(stat && stat.isDirectory()){
					walk(filePath, function(err,subDirFiles){
						if(err){ done(err); }
						results = results.concat(subDirFiles);
						if(--pendingFiles === 0){ done(null, results); }
					});
				} else {
					results.push(filePath);
					if(--pendingFiles === 0){ done(null, results); }

				}
			});
		});
	});
};



async.series(
	{
		detectDistro: function(callback) { 
			detectLinuxDistro(function(err,distro){
				if(distro === 'Ubuntu'){ nagiosCfg.path = '/etc/nagios3/nagios.cfg'; }
				else if (distro === 'CentOS'){ nagiosCfg.path = '/etc/nagios/nagios.cfg'; }
				callback(err,distro);
			});
		},

		parseNagiosCFG: function(callback){
			fs.readFile(nagiosCfg.path, function(err,data){
				nagiosCfg.main = data.toString().split('\n');
				
				for (i=0; i<nagiosCfg.main.length; i++){
					detectNagiosCfgDirectives(nagiosCfg.main[i]);
				}

				callback(err);
			});
		},

		findNagiosConfigFiles: function(callback){
			var pending = nagiosCfg.dirs.length;
			var addToCfgFiles = function(err,files){
				nagiosCfg.files = nagiosCfg.files.concat(files);
				if(--pending === 0){ callback(err); }
			};
			
			nagiosCfg.dirs.forEach(function(directory){
				walk(directory, addToCfgFiles);
			});
		},
		
		parseNagiosCfgFiles: function(callback){
			var pending = nagiosCfg.files.length;

			nagiosCfg.files.forEach(function(cfgFile){

				fs.readFile(cfgFile, function(err,buffer){
					if(err){ console.log(err); callback(err); }

					var lines = buffer.toString().split(/\n/);
					var newObject, objectType, inObjectDefn = false;
					var reDefinition = /\s*define\s*(\w*)\s*\{/;
					var reDirectives = /\s*(\w*)\s*([^;]*)/;

					lines.forEach(function(line){
						if(line.match(/^#/)){ null; }		// Comments
						else if(line.match(/^$/)){ null; }	// Blank Lines
						else if(reDefinition.exec(line)){	// Object Defn
							inObjectDefn = true;
							newObject = [];
							objectType = reDefinition.exec(line)[1] + 's';
						}
						else if (inObjectDefn === true){	// In Object Defn
							if(line.match(/\}/)){ 			// End of Object Defn
								inObjectDefn = false;
								nagiosObj[objectType].push(newObject);
							}
							else { newObject.push({			// Object Directives
									directive: reDirectives.exec(line)[1],
									value: reDirectives.exec(line)[2]
								});
							}
						}
						else { console.log(line); }
					});

					if(--pending===0){ callback(); }
				});

			});
		},
	},

	function(err,results){
		console.log('async callback');
	}
);
