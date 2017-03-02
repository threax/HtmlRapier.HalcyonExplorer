var compileJsnsTs = require('threax-gulp-tk/typescript.js');
var compileJavascript = require('threax-gulp-tk/javascript.js');

module.exports = function (rootDir, outDir, settings) {
    if(settings === undefined){
        settings = {};
    }

    var concat = true;
    if(settings.concat !== undefined){
        concat = settings.concat;
    }

    var minify = true;
    if(settings.minify !== undefined){
        minify = settings.minify;
    }

    return compileJsnsTs({
        libs: [
            __dirname + "/src/**/*.ts",
            "!**/*.intellisense.js"
        ],
        runners: [
        ],
        output: "HtmlRapierHalcyonClient",
        dest: outDir,
        sourceRoot: __dirname + "/src/",
        namespace: "hr.halcyon",
        concat: concat,
        minify: minify
    });
}