const emailHelper = require('../email/helper')
const emailClient = emailHelper()

module.exports = {
	update_password: (req, res) => {
    bcrypt.hash(req.body.password, saltRounds, function (err, hash) {
      req.app.db.collection('shops').findOneAndUpdate(
      {
        session_recovery_code: req.body.code
      },
      {
        "$set": { 
          password: hash,
          session_recovery_code: null 
        }
      },
      { 
        upsert: false, 
        'new': false,
        returnOriginal: true
      }).then(function(doc){
        const shop = doc.value

        if (!shop) {
          return res.status(404).send('No account found.')
        }

        return emailClient.send({
          to: shop.email,
          subject: 'Contraseña actualizada',
          data: {
            title:`Hola, ${shop.first_name}. Actualizaste tu contraseña.`,
            message:`El proceso de recuperación de cuenta se completó con éxito. Ya podés iniciar sesión con tu nueva contraseña.`,
            link: process.env.PANEL_URL,
            linkText:'Iniciar sesión ahora',
            tag: 'proveedor'
          },
          templatePath:path.join(__dirname,'/../email/template.html')
        }).then(function(){
          res.json({
            status: 'success'
          })
        }).catch(function(err){
          if(err) console.log(err)
          res.json({
            status: 'error: ' + err
          })
        })
      })
    })
  }
}