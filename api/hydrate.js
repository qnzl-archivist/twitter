const Vogel = require(`vogel`)
const dayjs = require(`dayjs`)

const {
  TWITTER_CONSUMER_KEY,
  TWITTER_CONSUMER_SECRET
} = process.env

module.exports = async (req, res, next) => {
  const auth = req.headers[`authorization`]

  const [ accessToken, accessTokenSecret ] = atob(auth).split(`:`)

  const {
    id
  } = req.params

  const twitter = new Vogel({
    consumerKey: TWITTER_CONSUMER_KEY,
    consumerSecret: TWITTER_CONSUMER_SECRET,
    accessToken,
    accessTokenSecret
  })

  const tweet = await twitter.get(`/1.1/statuses/show.json`, {
    query: {
      id,
      trim_user: true,
      include_ext_alt_text: true
    }
  })

  return res.json({
    tweet
  })
}

