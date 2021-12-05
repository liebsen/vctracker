const path = require('path')
const express = require("express")
const app = express()
const bodyParser = require('body-parser')
const mongodb = require('mongodb')
const cors = require('cors')
const moment = require('moment')
const axios = require('axios')
const emailHelper = require('./email/helper')
const emailClient = emailHelper()
const code = '999009275794'
let db = null

app.set('etag', false)
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json({ type: 'application/json' }))
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, 'static')))

app.use(function(req, res, next) {
	res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate')
	res.header("Access-Control-Allow-Origin", "*") // update to match the domain you will make the request from
	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
	next()
})

app.use(cors())

function checkStatus () {
	axios.post(`https://www.viacargo.com.ar/api/tracking/${code}/`, {}, { 
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:94.0) Gecko/20100101 Firefox/94.0',
      'Origin': 'https://www.viacargo.com.ar',
      'Referer': 'https://www.viacargo.com.ar/tracking',
      'Alt-Used': 'www.viacargo.com.ar'
    }
  }).then(res => {
    let time = moment().utc().format()
    let data = res.data.ok[0].objeto
		if (data) {
			db.collection('trackers').findOneAndUpdate({ 
        code: code 
      },{
        "$set": {
          data: data,
          lastUpdate: time
        }
      },{ 
        upsert: true, 
        'new': false
      }).then(function(doc) {
        if (!doc.value.data || (doc.value.data && doc.value.data.listaEventos.length !== data.listaEventos.length)) {
          console.log('sending notification...')
          let message = ''
          data.listaEventos.forEach(e => {
            message+= [e.fechaEvento, e.descripcion, e.tipoEvento, e.deleNombre].join(' | ') + '<br>'
          })
          return emailClient.send({
            to: 'telemagico@gmail.com',
            subject: `Tracking actualizado: ${code}`,
            data: {
              title: `Tracking actualizado: ${code}`,
              message: message,
              tag: 'proveedor'
            },
            templatePath:path.join(__dirname,'./email/template.html')
          }).catch(function(err){
            if(err) console.log(err)
          }).then(function(){
            res.status(200).send({ status: 'success' });
          })          
        }
      })
    }
	})
}

mongodb.MongoClient.connect(process.env.MONGO_URL, { useUnifiedTopology: true, useNewUrlParser: true }, function(err, database) {
	if(err) throw err
	db = database.db(process.env.MONGO_URL.split('/').reverse()[0])
	const port = process.env.PORT||4444
	setTimeout(checkStatus, 1000 * 60 * 60)
	checkStatus()
	app.listen(port, () => {
	  console.log(`Server running at https://localhost:${port}`)
	})
})
