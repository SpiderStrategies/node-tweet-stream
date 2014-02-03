var Transform = require('stream').Transform
  , util = require('util')

util.inherits(Parser, Transform)

function Parser () {
  Transform.call(this, { objectMode: true })
}

Parser.prototype._transform = function (data, encoding, done) {
  try {
    var obj = JSON.parse(data.toString())
    this.push(obj)
  } catch (e) {
    // don't care
  }
  done()
}

module.exports = Parser

