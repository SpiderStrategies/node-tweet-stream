var request = require('request')
  , Parser = require('./parser')
  , split = require('split')
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

var FILTER_TYPE_TRACKING = 'tracking'
  , FILTER_TYPE_LOCATION = 'location'
  , FILTER_TYPE_FOLLOW = 'follow'

var Twitter = function (oauth) {
  if(!(this instanceof Twitter)) {
    return new Twitter(oauth)
  }

  if (!oauth || !(oauth.consumer_secret || oauth.consumer_key || oauth.token || oauth.token_secret)) {
    throw new Error('Oauth credentials required')
  }
  this.oauth = oauth

  this._filters = {
    tracking: {},
    location: {},
    follow: {}
  }

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

Twitter.prototype.addFilter = function (filter, keyword, reconnect) {
  reconnect = typeof reconnect === 'undefined' || reconnect

  if (this._filters[filter][keyword]) {
    this._filters[filter][keyword]++
  } else {
    this._filters[filter][keyword] = 1
    this.stale = true
    if (reconnect) {
      this.reconnect()
    }
  }
}

Twitter.prototype.track = function (keyword, reconnect) {
  this.addFilter(FILTER_TYPE_TRACKING, keyword, reconnect)
}

Twitter.prototype.location = function (location, reconnect) {
  this.addFilter(FILTER_TYPE_LOCATION, location, reconnect)
}

Twitter.prototype.follow = function (follow, reconnect) {
  this.addFilter(FILTER_TYPE_FOLLOW, follow, reconnect)
}

Twitter.prototype.tracking = function () {
  return Object.keys(this._filters[FILTER_TYPE_TRACKING])
}

Twitter.prototype.locations = function () {
  return Object.keys(this._filters[FILTER_TYPE_LOCATION])
}

Twitter.prototype.following = function () {
  return Object.keys(this._filters[FILTER_TYPE_FOLLOW]);
};

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

Twitter.prototype.removeFilter = function (filter, keyword, reconnect) {
  reconnect = typeof reconnect === 'undefined' || reconnect

  if (typeof this._filters[filter][keyword] === 'undefined') {
    return
  }
  if (--this._filters[filter][keyword] === 0) {
    delete this._filters[filter][keyword]
    this.stale = true
    if (reconnect) {
      this.reconnect()
    }
  }
}

Twitter.prototype.untrack = function (keyword, reconnect) {
  this.removeFilter(FILTER_TYPE_TRACKING, keyword, reconnect)
}

Twitter.prototype.unlocate = function (location, reconnect) {
  this.removeFilter(FILTER_TYPE_LOCATION, location, reconnect)
}

Twitter.prototype.unfollow = function (follow, reconnect) {
  this.removeFilter(FILTER_TYPE_FOLLOW, follow, reconnect)
}

Twitter.prototype.hasFilters = function () {
  return this.tracking().length > 0 || this.locations().length > 0 || this.following().length > 0
}

Twitter.prototype.connect = function () {
  this.stale = false
  if (!this.hasFilters()) {
    return
  }

  this.stream = request.post({
    url: 'https://stream.twitter.com/1.1/statuses/filter.json',
    oauth: this.oauth,
    form: {
      track: Object.keys(this._filters[FILTER_TYPE_TRACKING]).join(','),
      locations: Object.keys(this._filters[FILTER_TYPE_LOCATION]).join(','),
      follow: Object.keys(this._filters[FILTER_TYPE_FOLLOW]).join(',')
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

    this.parser = this.stream.pipe(split()).pipe(new Parser)
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
