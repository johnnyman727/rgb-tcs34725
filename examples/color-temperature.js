var tessel = require('tessel');
var rgbLib = require('../');
var rgb = rgbLib.use(tessel.port.A);

rgb.on('ready', function() {
  
  setInterval(function() {
    rgb.calculateColorTemperature(function(err, temp) {
      if (err) throw err;

      console.log('TEMP:', temp);
    })
  }, 1000);
})