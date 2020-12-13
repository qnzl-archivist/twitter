const Vogel = require(`vogel`)
const dayjs = require(`dayjs`)

const {
  TWITTER_CONSUMER_KEY,
  TWITTER_CONSUMER_SECRET
} = process.env

const createWindows = (entities, windowLength) => {
  let windows = []

  for(let i = 0; i < entities.length; i += 100) {
    const windowEnd = Math.max(i + 100, entities.length)

    windows.push(entities.slice(i, windowEnd))
  }

  return windows
}

const hydrateTweets = async (updates, twitter) => {
  console.debug(`finding updates to hydrate from ${updates.length} updates`)

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
    latestId
  } = req.query

  const twitter = new Vogel({
    consumerKey: TWITTER_CONSUMER_KEY,
    consumerSecret: TWITTER_CONSUMER_SECRET,
    accessToken,
    accessTokenSecret
  })

  const getInitialTimeline = async (tweets = [], maxId = ``) => {
    console.log(`get timeline: ${tweets.length} / ${maxId}`)

    const query = {
      // TODO Change to 200 before release
      count: 10
    }

    if (maxId) {
      Object.assign(query, { max_id: maxId })
    }

    const tlReq = await twitter.get(`/1.1/statuses/home_timeline.json`, {
      query
    })

    const statuses = await tlReq.json()

    if (statuses.errors) {
      return tweets
    }

    console.log(`Got ${statuses.length} tweets`)

    const lastStatus = statuses.slice(-1)[0]
    maxId = lastStatus.id

    tweets.push(...statuses)

    const rateLimitRemaining = tlReq.headers.get('x-rate-limit-remaining')
    if (Number(rateLimitRemaining) > 0) {
      return tweets
    } else {
      return tweets
    }
  }

  let updates = []

  if (!latestId) {
    updates = await getInitialTimeline([], ``)
  } else {
    // TODO Grab more if it isn't the tip.
    updates = await twitter.get(`/1.1/statuses/home_timeline.json`, {
      query: {
        count: 200,
        since_id: latestId
      }
    })
  }

  updates = await hydrateTweets(updates, twitter)

  return res.json({
    count: updates.length,
    entities: updates
  })
}
