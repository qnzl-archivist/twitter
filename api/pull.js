const Vogel = require(`vogel`)
const dayjs = require(`dayjs`)

const {
  TWITTER_CONSUMER_KEY,
  TWITTER_CONSUMER_SECRET
} = process.env

module.exports = async (req, res, next) => {
  const [ type, auth ] = req.headers[`authorization`].split(` `)

  console.log("AUTH:", auth)

  const [ accessToken, accessTokenSecret ] = Buffer.from(auth, `base64`).toString(`utf8`).split(`:`)

  console.log("TOKENS:", accessToken, accessTokenSecret)

  const twitter = new Vogel({
    consumerKey: TWITTER_CONSUMER_KEY,
    consumerSecret: TWITTER_CONSUMER_SECRET,
    accessToken,
    accessTokenSecret
  })

  const getInitialTimeline = async (tweets = [], maxId = ``) => {
    console.log(`get timeline: ${tweets.length} / ${maxId}`)

    const query = {
      count: 200
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

  let lastId = ``
  let updates = []

  if (!lastId) {
    updates = await getInitialTimeline([], ``)
  } else {
    // TODO Grab more if it isn't the tip.
    updates = await twitter.get(`/1.1/statuses/home_timeline.json`, {
      query: {
        count: 200,
        since_id: lastId
      }
    })
  }

  return res.json({
    count: updates.length,
    statuses: updates
  })
}
