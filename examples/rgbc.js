var tessel = require('tessel');
var rgbLib = require('../');
var rgb = rgbLib.use(tessel.port.A);

rgb.on('ready', function() {
  
  setInterval(function() {
    rgb.getRawData(function(err, colors) {
      if (err) throw err;

      console.log('RED:', colors.red);
      console.log('GREEN:', colors.green);
      console.log('BLUE:', colors.blue);
      console.log('CLEAR:', colors.clear);
    })
  }, 1000);
})