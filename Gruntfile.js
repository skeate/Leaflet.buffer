module.exports = function(grunt){
  var lrSnippet = require('grunt-contrib-livereload/lib/utils').livereloadSnippet;
  var mountFolder = function(connect, dir){
    return connect.static(require('path').resolve(dir), dir);
  };
  require('load-grunt-tasks')(grunt);

  grunt.loadNpmTasks('grunt-umd');


  grunt.initConfig({
    umd: {
      all: {
        options: {
          src: 'src/leaflet.buffer-src.js',
          dest: 'dist/leaflet.buffer.js', // optional, if missing the src will be used
          deps: {
            'default': ['jsts']
          }
        }
      }
    },
    clean: {
      dist: ['dist'],
      instrumented: ['instrumented']
    },
    uglify: {
      min: {
        files: {
          './dist/leaflet.buffer.min.js': ['./src/leaflet.buffer-src.js']
        }
      }
    },
    copy: {
      main: {
        files: [
          { src: './src/images/spritesheet.png', dest: './dist/images/spritesheet.png' },
          { src: './src/images/spritesheet-2x.png', dest: './dist/images/spritesheet-2x.png' }
        ]
      }
    },
    cssmin: {
      min: {
        files: {
          './dist/leaflet.buffer.css': ['./src/leaflet.buffer.css']
        }
      }
    },
    watch: {
      options: {
        livereload: true
      },
      dev: {
        files: ['./src/*'],
        tasks: [],
      }
    },
    selenium_start: {
      options: {port: 4445}
    },
    connect: {
      options: {
        port: 1234,
        hostname: 'localhost'
      },
      coverage: {
        options: {
          middleware: function(connect){
            return [
              lrSnippet,
              mountFolder(connect, 'instrumented'),
              connect.static(__dirname),
              mountFolder(connect, 'test')
            ];
          }
        }
      }
    },
    instrument: {
      files: 'src/*.js',
      options: {
        lazy: true,
        basePath: 'instrumented'
      }
    },
    protractor_coverage: {
      options: {
        keepAlive: true,
        noColor: false,
        coverageDir: 'coverage',
        args: {
          baseUrl: 'http://localhost:1234'
        }
      },
      local: {
        options: {
          configFile: 'test/protractor-local.conf.js'
        }
      },
      travis: {
        options: {
          configFile: 'test/protractor-travis.conf.js'
        }
      }
    },
    makeReport: {
      src: 'coverage/*.json',
      options: {
        type: 'lcov',
        dir: 'coverage',
        print: 'detail'
      }
    }
  });

  grunt.registerTask('travis', [
    'instrument',
    'connect:coverage',
    'protractor_coverage:travis',
    'makeReport',
    'clean:instrumented'
  ]);

  grunt.registerTask('test', [
    'selenium_start',
    'instrument',
    'connect:coverage',
    'protractor_coverage:local',
    'makeReport',
    'selenium_stop',
    'clean:instrumented'
  ]);

  grunt.registerTask('build', [
    'clean',
    'uglify:min',
    'copy',
    'umd:all',
    'cssmin:min',
  ]);
};
