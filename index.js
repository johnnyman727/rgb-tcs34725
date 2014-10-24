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
var TCS34725_ENABLE_AIEN = 0x10; /* RGBC Interrupt Enable */

var TCS34725_ATIME = 0x01; // Amount of time for ADC integration

var TCS34725_CONTROL = 0x0F; // Set the gain level

var TCS34725_CDATAL = 0x14; // Clear channel data
var TCS34725_RDATAL = 0x16; // Red channel data
var TCS34725_GDATAL = 0x18; // Green channel data
var TCS34725_BDATAL = 0x1A; // Blue channel data

var TCS34725_AILTL = 0x04 // Clear Low channel interrupt level
var TCS34725_AILTH = 0x05 // Set low channel interrupt level
var TCS34725_AIHTL = 0x06 // Clear high channel interrupt level
var TCS34725_AIHTH = 0x07 // Set high channel interrupt level

function use(hardware, callback) {
  return new RGB(hardware, callback);
}


function RGB(hardware, callback) {
  var self = this;
  self.hardware = hardware;
  self.i2c = hardware.I2C(TCS34725_ADDRESS);
  self.irq = hardware.digital[0];
  self.led = hardware.digital[1];
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

RGB.prototype.integrationTimes = {
  2.4 : 0xFF, /**<  2.4ms - 1 cycle    - Max Count: 1024  */
  24 : 0xF6, /**<  24ms  - 10 cycles  - Max Count: 10240 */
  50 : 0xEB, /**<  50ms  - 20 cycles  - Max Count: 20480 */
  101 : 0xD5, /**<  101ms - 42 cycles  - Max Count: 43008 */
  154 : 0xC0, /**<  154ms - 64 cycles  - Max Count: 65535 */
  300 : 0x00, /**<  700ms - 256 cycles - Max Count: 65535 */
};

RGB.prototype.gains = {
  1 : 0x00, /**<  No gain  */
  4 : 0x01, /**<  2x gain  */
  16 : 0x02, /**<  16x gain */
  60 : 0x03, /**<  60x gain */
};

RGB.prototype.failCallback = function(err, callback) {
  if (err) {

    if (callback) {
      callback(err);
    }

    return true;
  }

  return false;
};

RGB.prototype._initialize = function(callback) {
  var self = this;

  self._read8Bits(TCS34725_ID, function(err, id) {
    if (id.readUInt8(0) != MODULE_ID) {
      var err = new Error("Unable to read ID off module. It may not be connected properly");
      return self.failCallback(err, callback);
    }
    else {
      self.setIntegrationTime(self.integrationTimes[24], function(err) {
        if (!self.failCallback(err, callback)) {
          self.setGain(self.gains[1], function(err) {
            if (!self.failCallback(err, callback)) {
              self.enable(callback);
            }
          });
        }
      });
    }
  });
};

RGB.prototype.enable = function(callback) {
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
};

RGB.prototype.disable = function(callback) {
  reg & ~(TCS34725_ENABLE_PON | TCS34725_ENABLE_AEN)
  self._read8Bits(TCS34725_ENABLE, function(err, value) {
    value = valuereadUInt8(0);
    value &= ~(TCS34725_ENABLE_PON | TCS34725_ENABLE_AEN);
    self._write8Bits(value, callback);
  })
};

RGB.prototype.setIntegrationTime = function(time, callback) {
  this._write8Bits(TCS34725_ATIME, time, callback);
};

RGB.prototype.setGain = function(gain, callback) {
  this._write8Bits(TCS34725_CONTROL, gain, callback);
};

RGB.prototype._read8Bits = function(reg, callback) {
  this.i2c.transfer(new Buffer([TCS34725_COMMAND_BIT | reg]), 1, callback);
};

RGB.prototype._read16Bits = function(reg, callback) {
  this.i2c.transfer(new Buffer([TCS34725_COMMAND_BIT | reg]), 2, callback);
};

RGB.prototype._write8Bits = function(reg, value, callback) {
  this.i2c.send(new Buffer([TCS34725_COMMAND_BIT | reg, value & 0xFF]), callback);
};

RGB.prototype.getRawData = function(callback) {
  var self = this;

  var rgbc = {};
  
  var colors = ["clear", "red", "green", "blue"];

  async.eachSeries(colors, function getColor(color, callback) {
    self.readColor(color, function colorRead(err, colorValue) {
      if (err) {
        callback(err);
      }
      else {
        rgbc[color] = colorValue;
        callback();
      }
    });
  },
  function endReadings(err) {
    if (!self.failCallback(err, callback)) {
      if (callback) {
        callback(null, rgbc);
      }
    }
  });
};

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

  self._read16Bits(reg, function(err, color) {

    if (!self.failCallback(err, callback)) {
      if (callback) {
        callback(null, color.readUInt16BE(0));
      }
      return;
    }
  });
};

RGB.prototype.calculateColorTemperature = function(callback) {
  var self = this;

  self.getRawData(function(err, colors) {
    if (!self.failCallback(err, callback)) {
      /* 1. Map RGB values to their XYZ counterparts.    */
      /* Based on 6500K fluorescent, 3000K fluorescent   */
      /* and 60W incandescent values for a wide range.   */
      /* Note: Y = Illuminance or lux                    */
      var r = colors.red;
      var g = colors.green;
      var b = colors.blue;

      var X = (-0.14282 * r) + (1.54924 * g) + (-0.95641 * b);
      var Y = (-0.32466 * r) + (1.57837 * g) + (-0.73191 * b);
      var Z = (-0.68202 * r) + (0.77073 * g) + ( 0.56332 * b);

      /* 2. Calculate the chromaticity co-ordinates      */
      var xc = (X) / (X + Y + Z);
      var yc = (Y) / (X + Y + Z);

      /* 3. Use McCamy's formula to determine the CCT    */
      var n = (xc - 0.3320) / (0.1858 - yc);

      /* Calculate the final CCT */
      var cct = (449.0 * Math.pow(n, 3)) + (3525.0 * Math.pow(n, 2)) + (6823.3 * n) + 5520.33;

      /* Return the results in degrees Kelvin */
      if (callback) {
        callback(null, cct);
      }
    }
  });
};

RGB.prototype.calculateLux = function(callback) {
  var self = this;

  self.getRawData(function(err, colors) {
    if (!self.failCallback(err, callback)) {
      /* This only uses RGB ... how can we integrate clear or calculate lux */
      /* based exclusively on clear since this might be more reliable?      */
      var illuminance = (-0.32466 * colors.red) + (1.57837 * colors.green) + (-0.73191 * colors.blue);
      if (callback) {
        callback(null, illuminance);
      }

    }
  });
};

RGB.prototype.setInterrupt = function(enable, callback) {
  var self = this;

  self._read8Bits(TCS34725_ENABLE, function(err, val) {
    if (!self.failCallback(err, callback)) {
      if (enable) {
        val = val.readUInt8(0) | TCS34725_ENABLE_AIEN;

        self.irq.on('fall', function() {
          self._clearInterrupt(function() {
            self.emit('interrupt');
          });
        });
      }
      else {
        val &= ~TCS34725_ENABLE_AIEN

        self.irq.removeAllListeners();
      }
      self._write8Bits(TCS34725_ENABLE, val, callback);
    }
  })
};

RGB.prototype._clearInterrupt = function(callback) {
  var self = this;

  self.i2c.send(new Buffer([0x66]), callback);
};

RGB.prototype.setIntLimits = function(low, high, callback) {
  var self = this;

  self.setInterrupt(true, function(err) {
    if (!self.failCallback(err, callback)) {
      self._setLowIntLimit(low, function(err) {
        if (!self.failCallback(err, callback)) {
          self._setHighIntLimit(high, callback);
        }
      });
    }
  });
};

RGB.prototype._setLowIntLimit = function(val, callback) {
  var self = this;

  self._write8Bits(TCS34725_AILTL, val & 0xFF, function(err) {
    if (!self.failCallback(err, callback)) {
      self._write8Bits(TCS34725_AILTH, val >> 8, callback);
    }
  });
};

RGB.prototype._setHighIntLimit = function(val, callback) {
  var self = this;

  self._write8Bits(TCS34725_AIHTL, val & 0xFF, function(err) {
    if (!self.failCallback(err, callback)) {
      self._write8Bits(TCS34725_AIHTH, val >> 8, callback);
    }
  });
};

RGB.prototype.setLED = function(on, callback) {
  this.hardware.digital[1].output(on);

  if (callback) {
    callback();
  }
};

module.exports.use = use;
module.exports.RGB = RGB;