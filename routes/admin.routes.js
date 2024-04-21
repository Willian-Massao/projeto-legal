const routes = require('express').Router();
const helper = require('../helpers/helper');

const userDAO = require('../database/userDAO.js');
const imageDAO = require('../database/imageDAO.js');
const itemDAO = require('../database/itemDAO.js');
const adminDAO = require('../database/adminDAO.js');
const envioDAO = require('../database/melhorenvioDAO.js');
const refundDAO = require('../database/refoundDAO.js');
const commentDAO = require('../database/commentDAO.js');
const melhorEnvioDAO = require('../database/melhorenvioDAO.js');

const Envio = require('../controllers/EnvioController.js');

let controllerEnvio

routes.get('/users', helper.ensureAdmin, (req, res) => {
    const errorMessage = req.flash('error');
    const users = new userDAO();

    users.select().then( item =>{
        users.describe().then( index =>{
            index.forEach((element, i) => {
                if(element.Field === 'password'){
                    index.splice(i, 2);
                }
            });
            res.render('admin', {data: item, indexes: index, table: 'users', error: errorMessage});
        }).catch(err => res.status(500).send('Something broke!'));
    }).catch(err => res.status(500).send('Something broke!'));
});
//comments
routes.get('/comments', helper.ensureAdmin, (req, res) => {
    const errorMessage = req.flash('error');
    const comments = new commentDAO();

    comments.select().then( item =>{
        comments.describe().then( index =>{
            res.render('admin', {data: item, indexes: index, table: 'comments', error: errorMessage});
        }).catch(err => res.status(500).send('Something broke!'));
    }).catch(err => res.status(500).send('Something broke!'));
});

routes.get('/images', helper.ensureAdmin, (req, res) => {
    const errorMessage = req.flash('error');
    const images = new imageDAO();

    images.select().then( item =>{
        images.describe().then( index =>{
            res.render('admin', {data: item, indexes: index, table: 'images', error: errorMessage});
        }).catch(err => res.status(500).send('Something broke!'));
    }).catch(err => res.status(500).send('Something broke!'));
}); 
routes.get('/products', helper.ensureAdmin, (req, res) => {
    const errorMessage = req.flash('error');
    const itens = new itemDAO();
    
    itens.select().then( item =>{
        itens.describe().then( index =>{
            res.render('admin', {data: item, indexes: index, table: 'products', error: errorMessage});
        }).catch(err => res.status(500).send('Something broke!'));
    }).catch(err => res.status(500).send('Something broke!'));
});

routes.get('/admins', helper.ensureAdmin, (req, res) => {
    const errorMessage = req.flash('error');
    const admins = new adminDAO();
    
    admins.select().then( item =>{
        admins.describe().then( index =>{
            res.render('admin', {data: item, indexes: index, table: 'admins', error: errorMessage});
        }).catch(err => res.status(500).send('Something broke!'));
    }).catch(err => res.status(500).send('Something broke!'));
});

routes.get('/refund', helper.ensureAdmin, (req, res) => {
    const errorMessage = req.flash('error');
    const refund = new refundDAO();

    refund.select().then( item =>{
        refund.describe().then( index =>{
            res.render('admin', {data: item, indexes: index, table: 'refund', error: errorMessage});
        }).catch(err => res.status(500).send('Something broke!'));
    }).catch(err => res.status(500).send('Something broke!'));
});

routes.get('/etiqueta', helper.ensureAdmin, async (req, res) => {
    const errorMessage = req.flash('error');
    const melhorEnvio = new melhorEnvioDAO();

    let bearerMelhorEnvio = 'Bearer ';
    await melhorEnvio.buscaToken().then(bearer => {  bearerMelhorEnvio += bearer.access_token});
    
    let fetchres = await fetch('https://sandbox.melhorenvio.com.br/api/v2/me/cart',{
        method: 'GET',
        headers: {
            "Accept": "application/json",
            "Authorization": bearerMelhorEnvio,
            "User-Agent": "Aplicação (email para contato técnico)"
        }
    });

    if(fetchres.ok){
        let temp = await fetchres.json();
        let filter = [];
        let index = [];
        for (const key in temp.data[0]) {
            //if(temp.data[0][key] != null && (key != "invoice" && key != "tags" && key != "products" && key != "volumes")){
                index.push({Field: key, Type: 'varchar(255)', Null: 'YES', Key: '', Default: null, Extra: ''});
            //}
        }
        temp.data.forEach(element => {
            let temp = {};
            for (const key in element) {
                //if(element[key] != null){
                    if(key == "from" || key == "to"){
                        temp[key] = element[key].postal_code;
                    }else if(key == "service"){
                        temp[key] = element[key].name;
                    }else{//if(key != "invoice" && key != "tags" && key != "products" && key != "volumes"){
                        temp[key] = element[key];
                    }
                //}
            }
            filter.push(temp);
        });
        res.render('admin',{data: filter, indexes: index, table: 'etiqueta', error: errorMessage});
    }
});

routes.get('/envio', helper.ensureAdmin, async(req, res) => {
    const errorMessage = req.flash('error');
   if(req.query.code){
        let envio = new envioDAO();
        let code = req.query.code;
        
        let fetchres = await fetch('https://sandbox.melhorenvio.com.br/oauth/token',{
            method: 'POST',
            headers: {
                "Content-Type": "routeslication/json",
            }, body:JSON.stringify({
                "client_id": controllerEnvio.client_id,
                "client_secret": controllerEnvio.client_secret,
                "redirect_uri": controllerEnvio.redirect_uri,
                "code": code,
                "grant_type": "authorization_code"
            })
        });

        if(fetchres.ok){
            let temp = await fetchres.json();

            controllerEnvio.access_token = temp.access_token;
            controllerEnvio.refresh_token = temp.refresh_token;
            let date = new Date();
            date.setSeconds(date.getSeconds() + temp.expires_in);
            controllerEnvio.expired_at = date;

            envio.insertOrUpdate(controllerEnvio);
        }
    }
    res.render('frete',{error: errorMessage});
});

routes.post('/envio', async(req, res) => {
    const { client_id, client_secret, redirect_uri } = req.body;
    let url = 'https://sandbox.melhorenvio.com.br/oauth/authorize';
    let concatenatedString = '';
    controllerEnvio = new Envio({ client_id, client_secret, redirect_uri });

    for (const key in req.body) {
        if (req.body[key] === 'on') {
            concatenatedString += key + ' ';
        }
    }
    url += `?client_id=${client_id}`
    url += `&redirect_uri=${redirect_uri}`
    url += `&response_type=code`
    url += `&scope=${concatenatedString}`
    res.redirect(url);
});

module.exports = routes;