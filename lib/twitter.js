var request = require('request')
  , Parser = require('./parser')
  , Writable = require('stream').Writable
  , util = require('util')

var Twitter = function (oauth) {
  if(!(this instanceof Twitter)) {
    return new Tweets(arguments)
  }

  if (!oauth) {
    throw new Error('Oauth credentials required')
  }
  this.oauth = oauth

  this.tracking = []

  Writable.call(this, {objectMode: true})
}

util.inherits(Twitter, Writable)

Twitter.prototype.track = function (keyword) {
  var idx = this.tracking.indexOf(keyword)
  if (idx === -1) {
    this.tracking.push(keyword)
    if (this.stream) {
      this.abort()
    }
    this.connect()
  }
}

Twitter.prototype._write = function (data, encoding, done) {
  if (data.text) {
    this.emit('tweet', data)
  }
  done()
}

Twitter.prototype.untrack = function (keyword) {
  var idx = this.tracking.indexOf(keyword)
  if (idx > -1) {
    this.tracking.splice(idx, 1)
  }

  if (this.stream) {
    this.abort()
  }
  this.connect()
}

Twitter.prototype.connect = function () {
  if (this.tracking.length === 0) {
    return
  }

  this.stream = request.post({
    url: 'https://stream.twitter.com/1.1/statuses/filter.json',
    oauth: this.oauth,
    form: {
      track: this.tracking.join(',')
    }
  })

  this.stream.on('response', (function (res, e) {
    if (res.statusCode === 200) {
      this.stream.pipe(new Parser).pipe(this)

      // Handle this: https://dev.twitter.com/docs/streaming-apis/connecting#Stalls
      this.stream.on('data', (function () {
        var close = (function () {
            if (this.stream) {
              this.abort()
            }
          }).bind(this)
          , interval = 1000 * 90 // twitter timeout is 90 seconds
          , timeout = setTimeout(close, interval)

        return function () {
          clearTimeout(timeout)
          timeout = setTimeout(close, interval)
        }
      })())

    } else {
      this.emit('error', new Error('Twitter error ' + res.statusCode))
    }
  }).bind(this))

  this.stream.on('error', (function (err) {
    this.emit('error', err)
  }).bind(this))
}

Twitter.prototype.abort = function () {
  this.stream.removeAllListeners()

  this.stream.abort()
}

module.exports = Twitter
