var tessel = require('tessel');
var rgbLib = require('../');
var rgb = rgbLib.use(tessel.port.A);

rgb.on('ready', function() {
  
  setInterval(function() {
    rgb.calculateLux(function(err, lux) {
      if (err) throw err;

      console.log('LUX:', lux);
    })
  }, 1000);
})