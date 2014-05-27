var request = require('request')
  , Parser = require('./parser')
  , Writable = require('stream').Writable
  , util = require('util')

function backoff (current, max, step, _value) {
  return function () {
    if ((_value = current) > max) {
      throw new Error('Exceeded twitter rate limit')
    }
    current = step(current)
    return _value
  }

}

var Twitter = function (oauth) {
  if(!(this instanceof Twitter)) {
    return new Twitter(oauth)
  }

  if (!oauth || !(oauth.consumer_secret || oauth.consumer_key || oauth.token || oauth.token_secret)) {
    throw new Error('Oauth credentials required')
  }
  this.oauth = oauth

  this._tracking = {}
  this.backoffs()

  Writable.call(this, {objectMode: true})
}

util.inherits(Twitter, Writable)

// Backup strategies based off twitter's guidelines
//    See https://dev.twitter.com/docs/streaming-apis/connecting#Reconnecting
Twitter.prototype.backoffs = function () {
  // Network hiccup, try every 250 seconds
  this.networkBackoff = backoff(0, 16 * 1000, function (x) { return x + 250 })
  // Rate limited. Try exponetially starting at 5 seconds
  this.httpBackoff = backoff(5 * 1000, 320 * 1000, function (x) { return x * 2 })
  // Rate limited. Try exponetially starting at a minute
  this.rateBackoff = backoff(60 * 1000, 320 * 1000, function (x) { return x * 2 })
}

Twitter.prototype.track = function (keyword, reconnect) {
  reconnect = typeof reconnect === 'undefined' || reconnect

  if (this._tracking[keyword]) {
    this._tracking[keyword]++
  } else {
    this._tracking[keyword] = 1
    this.stale = true
    if (reconnect) {
      this.reconnect()
    }
  }
}

Twitter.prototype.tracking = function () {
  return Object.keys(this._tracking)
}

Twitter.prototype.reconnect = function () {
  if (this.stale) {
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

Twitter.prototype.untrack = function (keyword, reconnect) {
  reconnect = typeof reconnect === 'undefined' || reconnect

  if (typeof this._tracking[keyword] === 'undefined') {
    return
  }
  if (--this._tracking[keyword] === 0) {
    delete this._tracking[keyword]
    this.stale = true
    if (reconnect) {
      this.reconnect()
    }
  }
}

Twitter.prototype.connect = function () {
  this.stale = false
  if (Object.keys(this._tracking).length === 0) {
    return
  }

  this.stream = request.post({
    url: 'https://stream.twitter.com/1.1/statuses/filter.json',
    oauth: this.oauth,
    form: {
      track: Object.keys(this._tracking).join(',')
    }
  })

  this.stream.on('response', (function (res, e) {
    var self = this
    // Rate limited...
    if (res.statusCode === 420) {
      this.abort()
      setTimeout(function () {
        self.connect()
      }, this.rateBackoff())

      this.emit('reconnect', {type: 'rate-limit'})
      return
    }

    // Http error
    if(res.statusCode > 200) {
      this.abort()
      setTimeout(function () {
        self.connect()
      }, this.httpBackoff())

      this.emit('reconnect', {type: 'http', err: new Error('Twitter connection error' + res.statusCode)})
      return
    }

    // 200. Alive and well.
    this.backoffs()

    this.parser = this.stream.pipe(new Parser)
    this.parser.pipe(this)

    this.stream.on('data', (function () {
      // Handle this: https://dev.twitter.com/docs/streaming-apis/connecting#Stalls
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
  }).bind(this))

  this.stream.on('error', (function (err) {
    var self = this
    this.abort()
    this.emit('reconnect', {type: 'network', err: err})
    setTimeout(function () {
      self.connect()
    }, this.networkBackoff())
  }).bind(this))
}

Twitter.prototype.abort = function () {
  if (this.parser) {
    this.parser.unpipe(this)
  }

  this.stream.abort()
  this.stream = null
}

module.exports = Twitter
