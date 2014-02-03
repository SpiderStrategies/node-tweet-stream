var Parser = require('../lib/parser')
  , PassThrough = require('stream').PassThrough
  , assert = require('assert')

describe('parser', function () {
  var parser, through

  it('parses the twitter text', function (done) {
    parser.on('data', function (data) {
      assert.deepEqual(data, {text: 'tweet body'})
      done()
    })

    through.push('{"text": "tweet body"}')
    through.pipe(parser)
  })

  it('ignore new line heartbeat checks', function (done) {
    parser.on('data', function (data) {
      done(new Error('Should not emit data event'))
    })

    parser.on('end', function () {
      done()
    })

    through.push('\n')
    through.pipe(parser)
    through.end()
  })

  beforeEach(function () {
    parser = new Parser
    through = new PassThrough
  })

})
