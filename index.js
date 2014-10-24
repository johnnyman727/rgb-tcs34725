var events = require('events');
var util = require('util');
var async = require('async');

var MODULE_ID = 0x44; // The ID that should always be returned by this module
var TCS34725_ADDRESS = 0x29; // The I2C address of this module
var TCS34725_ID = 0x012; // The command to read the module ID
var TCS34725_COMMAND_BIT = 0x80; // The command to signal that we're command it to do something

var TCS34725_ENABLE = 0x00; // Enable operations
var TCS34725_ENABLE_PON = 0x01; // Power on
var TCS34725_ENABLE_AEN = 0x02; // RGBC Enable

var TCS34725_ATIME = 0x01; // Amount of time for ADC integration

var TCS34725_CONTROL = 0x0F; // Set the gain level

var TCS34725_INTEGRATIONTIME_2_4MS  = 0xFF;   /**<  2.4ms - 1 cycle    - Max Count: 1024  */
var TCS34725_INTEGRATIONTIME_24MS   = 0xF6;   /**<  24ms  - 10 cycles  - Max Count: 10240 */
var TCS34725_INTEGRATIONTIME_50MS   = 0xEB;   /**<  50ms  - 20 cycles  - Max Count: 20480 */
var TCS34725_INTEGRATIONTIME_101MS  = 0xD5;   /**<  101ms - 42 cycles  - Max Count: 43008 */
var TCS34725_INTEGRATIONTIME_154MS  = 0xC0;   /**<  154ms - 64 cycles  - Max Count: 65535 */
var TCS34725_INTEGRATIONTIME_700MS  = 0x00;   /**<  700ms - 256 cycles - Max Count: 65535 */

var TCS34725_GAIN_1X                = 0x00;   /**<  No gain  */
var TCS34725_GAIN_4X                = 0x01;   /**<  2x gain  */
var TCS34725_GAIN_16X               = 0x02;   /**<  16x gain */
var TCS34725_GAIN_60X               = 0x03;   /**<  60x gain */

var TCS34725_CDATAL = 0x14; // Clear channel data
var TCS34725_RDATAL = 0x16; // Red channel data
var TCS34725_GDATAL = 0x18; // Green channel data
var TCS34725_BDATAL = 0x1A; // Blue channel data

function use(hardware, callback) {
  return new RGB(hardware, callback);
}


function RGB(hardware, callback) {
  var self = this;
  self.hardware = hardware;
  self.i2c = hardware.I2C(TCS34725_ADDRESS);
  self._initialize(function(err) {
    if (self.failCallback(err, callback)) {
      setImmediate(function() {
        this.emit('error', err);
      }.bind(this));
      return;
    }
    else {
      setImmediate(function() {
        self.emit('ready');
      });
      if (callback) {
        callback(null, self);
      }
      return;
    }
  });
}

util.inherits(RGB, events.EventEmitter);

RGB.prototype.failCallback = function(err, callback) {
  if (err) {

    if (callback) {
      callback(err);
    }

    return true;
  }

  return false;
}

RGB.prototype._initialize = function(callback) {
  var self = this;

  self._read8Bits(TCS34725_ID, function(err, id) {
    if (id.readUInt8(0) != MODULE_ID) {
      var err = new Error("Unable to read ID off module. It may not be connected properly");
      return self.failCallback(err, callback);
    }
    else {
      self.setIntegrationTime(TCS34725_INTEGRATIONTIME_2_4MS, function(err) {
        if (!self.failCallback(err, callback)) {
          self.setGain(0x00, function(err) {
            if (!self.failCallback(err, callback)) {
              self._enable(callback);
            }
          });
        }
      });
    }
  });
}

RGB.prototype._enable = function(callback) {
  var self = this;

  function fail(err, callback) {
    if (err) {
      if (callback) {
        callback(err);
      }
      return 1;
    }
    return 0;
  }
  self._write8Bits(TCS34725_ENABLE, TCS34725_ENABLE_PON, function(err) {
    if (!fail(err, callback)) {
      self._write8Bits(TCS34725_ENABLE, TCS34725_ENABLE_PON | TCS34725_ENABLE_AEN, function(err) {
        if (!fail(err, callback)) {
          if (callback) {
            callback();
          }
          return;
        }
      })
    }
  })
}

RGB.prototype.setIntegrationTime = function(time, callback) {
  this._write8Bits(TCS34725_ATIME, time, callback);
}

RGB.prototype.setGain = function(gain, callback) {
  this._write8Bits(TCS34725_CONTROL, gain, callback);
}

RGB.prototype._read8Bits = function(reg, callback) {
  this.i2c.transfer(new Buffer([TCS34725_COMMAND_BIT | reg]), 1, callback);
}

RGB.prototype._read16Bits = function(reg, callback) {
  this.i2c.transfer(new Buffer([TCS34725_COMMAND_BIT | reg]), 2, callback);
}

RGB.prototype._write8Bits = function(reg, value, callback) {
  this.i2c.send(new Buffer([TCS34725_COMMAND_BIT | reg], value & 0xFF), callback);
}

RGB.prototype.getRGBC = function(callback) {
  var self = this;

  var rgbc = {};
  
  var colors = ["clear", "red", "green", "blue"];

  async.eachSeries(colors, function getColor(color, callback) {
    self.readColor(color, function colorRead(err, colorValue) {
      if (err) {
        callback(err);
      }
      else {
        console.log('setting', colorValue);
        rgbc[color] = colorValue;
        callback();
      }
    });
  },
  function endReadings(err) {
    if (!self.failCallback(err, callback)) {
      console.log('colors!', rgbc);
      if (callback) {
        callback(null, rgbc);
      }
    }
  });
}

RGB.prototype.readColor = function(color, callback) {
  var self = this;
  var reg;

  color = color.toLowerCase();

  switch(color) {
    case "clear":
      reg = TCS34725_CDATAL;
      break;
    case "red":
      reg = TCS34725_RDATAL;
      break;
    case "green":
      reg = TCS34725_GDATAL;
      break;
    case "blue":
      reg = TCS34725_BDATAL;
      break;
  }

  console.log('set reg', reg);

  self._read16Bits(reg, function(err, color) {
    console.log('read', err, color);
    if (!self.failCallback(err, callback)) {
      if (callback) {
        callback(null, color.readUInt16BE(0));
      }
      return;
    }
  });
};

RGB.prototype.setLED = function(on, callback) {
  this.hardware.digital[0].output(on);

  if (callback) {
    callback();
  }
};

var tessel = require('tessel');
var r = use(tessel.port.A);
r.on('ready', function() {
  console.log('use me!');
  // r.setLED(false);

  r.getRGBC(function(err, rgbc) {
    console.log('got this!', rgbc);
  })
})