const Vogel = require(`vogel`)
const dayjs = require(`dayjs`)

const {
  TWITTER_CONSUMER_KEY,
  TWITTER_CONSUMER_SECRET
} = process.env

const createWindows = (entities, windowLength) => {
  // Twitter only allows us to hydrate 100 tweets at a time.
  let windows = []

  for(let i = 0; i < entities.length; i += 100) {
    const windowEnd = Math.max(i + 100, entities.length)

    windows.push(entities.slice(i, windowEnd))
  }

  return windows
}

const hydrateTweets = async (updates, twitter) => {
  console.debug(`finding updates to hydrate from ${updates.length} updates`)

  // We don't want to re-request full hydrated tweets
  let needHydrationIds = updates.map((entity) => {
    let ids = []

    if (entity.truncated) {
      ids.push(entity.id_str)
    } else if (entity.retweeted_status && entity.retweeted_status.truncated) {
      ids.push(entity.retweeted_status.id_str)
    }

    return ids
  })

  needHydrationIds = [].concat(...needHydrationIds)

  console.debug(`hydrating ${needHydrationIds.length} updates`)

  const idWindows = createWindows(needHydrationIds, 100)

  const promises = idWindows.map(async (idWindow) => {
    console.debug(`hydrating ${idWindow[0]}-${idWindow.slice(-1)[0]}`)

    // Look up 100 tweets at a time, to get full message
    const hydrationRes = await twitter.post(`/1.1/statuses/lookup.json`, {
      query: {
        id: idWindow.join(`,`),
        map: true,
        include_entities: true
      }
    })

    return hydrationRes.json()
  })

  const hydratedUpdateArrays = await Promise.all(promises)

  const hydratedUpdates = [].concat(...hydratedUpdateArrays)

  return updates.map((tweet) => {
    const { id_str: tweetId } = tweet

    const hydratedTweet = hydratedUpdates[tweetId]

    // Check if we re-hydrated the retweet
    if (!hydratedTweet && tweet.retweeted_status) {
      const hydratedRetweet = hydratedUpdates[tweet.retweeted_status.id_str]

      if (hydratedRetweet) {
        tweet.retweeted_status = hydratedTweet
      }
    }

    return hydratedTweet || tweet
  })
}

module.exports = async (req, res, next) => {
  const [ type, auth ] = req.headers[`authorization`].split(` `)

  if (!type && !auth) {
    return res.sendStatus(401)
  }

  const [ accessToken, accessTokenSecret ] = Buffer.from(auth, `base64`).toString(`utf8`).split(`:`)

  if (!accessToken || !accessTokenSecret) {
    return res.sendStatus(401)
  }

  const {
    latestId,
    scope,
  } = req.query

  console.log("CONSUMER:", accessToken, accessTokenSecret)
  const twitter = new Vogel({
    consumerKey: TWITTER_CONSUMER_KEY,
    consumerSecret: TWITTER_CONSUMER_SECRET,
    accessToken,
    accessTokenSecret
  })

  const getTimeline = async (tweets = [], maxId = ``) => {
    console.log(`get timeline: ${tweets.length} / ${maxId}`)

    const query = {
      // TODO Change to 200 before release
      count: 10,
    }

    // Gets tweets from authenticated user
    //
    // User is authenticated through `accessToken` and `accessTokenSecret`
    // passed through Authorization header
    const tlReq = await twitter.get(`/1.1/statuses/home_timeline.json`, {
      query
    })

    const statuses = await tlReq.json()

    console.log("STATUSES: ", statuses)
    if (statuses.errors) {
      return tweets
    }

    let rateLimitRemaining = tlReq.headers.get('x-rate-limit-remaining')

    console.log(`Got ${statuses.length} tweets`)

    // Keep track of the oldest ID so we can retrieve more if needed
    const lastStatus = statuses.slice(-1)[0]
    if (maxId === lastStatus.id) {
      console.warn(`got the same max id we had last time, stopping iteration`)

      rateLimitRemaining = 0
    }

    maxId = lastStatus.id

    tweets.push(...statuses)

    // We want to try to use up the rate limit, pulling up as much as possible
    if (Number(rateLimitRemaining) > 0) {
      return tweets
    } else {
      return tweets
    }
  }

  const getPersonalTweets = async (tweets = [], maxId = ``) => {
    console.log(`get timeline: ${tweets.length} / ${maxId}`)

    const query = {
      // TODO Change to 200 before release
      count: 10
    }

    const tlReq = await twitter.get(`/1.1/statuses/user_timeline.json`, {
      query
    })

    const statuses = await tlReq.json()

    if (statuses.errors) {
      return tweets
    }

    let rateLimitRemaining = tlReq.headers.get('x-rate-limit-remaining')

    console.log(`Got ${statuses.length} tweets`)

    // Keep track of the oldest ID so we can retrieve more if needed
    const lastStatus = statuses.slice(-1)[0]
    if (maxId === lastStatus.id) {
      console.warn(`got the same max id we had last time, stopping iteration`)

      rateLimitRemaining = 0
    }

    maxId = lastStatus.id

    tweets.push(...statuses)

    // We want to try to use up the rate limit, pulling up as much as possible
    if (Number(rateLimitRemaining) > 0) {
      return tweets
    } else {
      return tweets
    }
  }

  let entities
  if (scope === `timeline`) {
    console.log(`get timeline`)
    entities = await getTimeline([], latestId)
  } else if (scope === `personal`) {
    console.log(`get personal`)
    entities = await getPersonalTweets([], latestId)
  } else {
    console.log(`get both`)
    const timeline = await getTimeline([], latestId)
    entities = await getPersonalTweets(timeline, latestId)
  }

  entities = entities.map((tweet) => {
    tweet.id = tweet.id_str

    return tweet
  })

  entities = await hydrateTweets(entities, twitter)

  return res.json({
    entities,
  })
}
