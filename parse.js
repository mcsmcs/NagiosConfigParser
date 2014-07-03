'use strict';
/*jslint unparam: true, node: true */

var sys = require('sys');
var exec = require('child_process').exec;
var async = require('async');
var fs = require('fs');
var child;
var i,j,k;

var nagiosCfg = {
	path: null,
	main: [],
	dirs: [],
	files: []
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

				callback();
			});

		},

		parseNagiosCfgDirs: function(callback){
			var files, i;

			var addToCfgFiles = function(filename, index, array){ nagiosCfg.files.push(nagiosCfg.dirs[i] + '/' + filename); };

			for (i=0; i<nagiosCfg.dirs.length; i++){
				files = fs.readdirSync(nagiosCfg.dirs[i]);
				files.forEach(addToCfgFiles);
			}
			callback();
		},
		
		parseNagiosCfgFiles: function(callback){
			callback();
		},

	},
	function(err,results){
		console.log('async callback');
		console.log(nagiosCfg.files);
		console.log(nagiosCfg.dirs);
	}
);

