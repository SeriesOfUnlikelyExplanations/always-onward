// Require the framework and instantiate it - https://github.com/jeremydaly/lambda-api
const api = require('lambda-api')()

// Define a route
api.get('/api/status', async (req,res) => {
  return { status: 'ok - api' }
})

api.register(require('./api'), { prefix: '/api' })
api.register(require('./static-routes'))


module.exports = api

//~ // Declare your Lambda handler
//~ exports.handler = async (event, context) => {
  //~ // Run the request
  //~ console.log(event);
  //~ return await api.run(event, context)
//~ }

