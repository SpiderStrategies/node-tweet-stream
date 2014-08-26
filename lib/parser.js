var Transform = require('stream').Transform,
  util = require('util')

util.inherits(Parser, Transform)

function Parser() {
  Transform.call(this, {
    objectMode: true
  })
  this.buffer = '';
}

Parser.prototype._transform = function(data, encoding, done) {
  this.buffer += data.toString('utf8');
  var index, json;

  while ((index = this.buffer.indexOf('\r\n')) > -1) {
    json = this.buffer.slice(0, index);
    this.buffer = this.buffer.slice(index + 2);
    if (json.length > 0) {
      try {
        var obj = JSON.parse(json)
        this.push(obj)
      } catch (e) {

      }
    }
  }
  done()
}

module.exports = Parser
