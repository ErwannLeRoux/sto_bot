
let {Client, MessageEmbed} = require('discord.js');
let fs = require('fs');
let express = require('express');
let bodyParser = require('body-parser');
let fetch = require('node-fetch');

let paniers = []
let buildingMenu = false

async function getMenus() {
  return await fetch('http://saladetomateoignons.ddns.net/api/menus').then(response => response.json())
}

async function getSupplement() {

  return await fetch('http://saladetomateoignons.ddns.net/api/products').then(response => response.json())
}

async function getIngredients() {
  return await fetch('http://saladetomateoignons.ddns.net/api/ingredients').then(response => response.json())
}

async function getUserId(discordId) {
  return await fetch(`http://saladetomateoignons.ddns.net/userIDFromDiscord/${discordId}`).then(response => response.json())
}

function sendMenus(msg) {
  msg.author.createDM().then(channel => {
    //channel.send('Les Menus !')
    let embed = new MessageEmbed()
      .setTitle('Nos Menus')
      .setColor(0xff0000);

    getMenus().then(function(res) {
      res["hydra:member"].forEach(menu => {
        embed.addField(menu.name+" - "+menu.price+"€", menu.description)
      });
      channel.send(embed);
    })
  })
}

function sendSupplements(msg) {
  msg.author.createDM().then(channel => {
    //channel.send('Les Menus !')
    let embed = new MessageEmbed()
      .setTitle('Nos Suppléments')
      .setColor(0xff0000);

    getSupplement().then(function(res) {
      res["hydra:member"].forEach(supp => {
        if(supp.category != "/api/product_categories/4") {
            embed.addField(supp.name+" - "+supp.price+"€", supp.description)
        }
      });
      channel.send(embed);
    })
  })
}

function sendDM(msg) {
  if (msg.content === '!commande') {
    if(msg.channel.name === 'général') {
      msg.reply("Je viens prendre ta commande en MP !")
    }
    msg.author.createDM().then(channel => {
      channel.send('Chef Nassim j\'écoute ta commande ! Tu peux voir la liste des menus et des suppléments disponibles. Si tu n\'as jamais commandé tu peux lire le tutoriel :smile:')
      sendMenus(msg)
      sendSupplements(msg)
    })
  }
}

function sendPanier(msg) {
  msg.author.createDM().then(channel => {
    //channel.send('Les Menus !')
    let total = 0
    let embed = new MessageEmbed()
      .setTitle('Ton Panier')
      .setColor(0xff0000)

    if(!paniers[msg.author.tag]) {
      paniers[msg.author.tag] = {
        menus: [],
        supplements: []
      }
    }

    paniers[msg.author.tag]["menus"].forEach(function(menu) {
        embed.addField("1x "+menu.name+" - "+menu.price+"€", menu.description)
        total += menu.price
    })

    paniers[msg.author.tag]["supplements"].forEach(function(supp) {
        embed.addField("1x "+supp.name+" - "+supp.price+"€", supp.description)
        total += supp.price
    })

    if(paniers[msg.author.tag]["supplements"].length == 0 && paniers[msg.author.tag]["menus"].length == 0) {
      embed = "Ton panier est vide :cry:"
    } else {
      embed.addField(`Total - ${total}€`, "Tape !valider pour passer ta commande")
    }

    channel.send(embed);
  })
}

function sendUnknown(msg) {
  msg.author.createDM().then(channel => {
    channel.send("Nous n'avons pas ce que tu demandes")
  })
}

async function sendValidate(msg) {
  let total = 0
  let user = await getUserId(msg.author.id)
  let purchaseSupplements = []
  let purchasesMenus = []

  if(user.id != -1) {
    paniers[msg.author.tag]["menus"].forEach(function(menu) {
        total += menu.price

        purchasesMenus.push({
          formule: menu["@id"],
          customerComment: menu.comment,
          content: menu.content
        })
    })

    paniers[msg.author.tag]["supplements"].forEach(function(supp) {
        total += supp.price
        purchaseSupplements.push({ qty: 1, product: supp["@id"]})
    })

    // TODO: Replace with real purchase
    let data = {
      "user": "/api/users/"+user.id,
      "date": new Date().toISOString(),
      "purshaseMenuses" : purchasesMenus,
      "status": "En attente de validation",
      "purshaseProducts": purchaseSupplements,
      "total": total
    }

    fetch('http://saladetomateoignons.ddns.net/api/purshases', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' }
    })
    .then(response => response.json())
    .then(json => console.log(json))
    .catch(console.error)

    msg.author.createDM().then(channel => {
      channel.send('Commande validée, en cuisine Emile ! :smile:')
    })
  } else {
    msg.author.createDM().then(channel => {
      channel.send('Il semblerait que tu n\'ais pas de compte sur notre site, inscris toi vite et associe ton compte discord ! :smile:')
    })
  }
}

function resetShop(msg) {
  paniers[msg.author.tag] = {
    menus: [],
    supplements: []
  }

  msg.author.createDM().then(channel => {
    channel.send('J\'ai vidé ton panier :smile:')
  })
}

async function processDefault(msg) {
  let menusList = await getMenus()
  let supplementsList = await getSupplement()
  let ingredientsList = await getIngredients()

  // init panier
  if(!paniers[msg.author.tag]) {
    paniers[msg.author.tag] = {
      menus: [],
      supplements: []
    }
  }

  let panier = paniers[msg.author.tag]

  if(msg.content.startsWith("?")) {
    let parts = msg.content.split('?')
    // accomp categorie 2
    // boisson categorie 1

    if(parts.length == 6) {
      // menu et composition
      let selectedMenu = parts[1].trim()
      let boisson      = parts[2].trim()
      let accomp       = parts[3].trim()
      let sauce        = parts[4].trim()
      let comment      = parts[5].trim()

      // menu
      menuObj = menusList["hydra:member"].find(menu => {
        return menu.name === selectedMenu
      })

      // boisson
      boissonObj = supplementsList["hydra:member"].find(supp => {
        return supp.name === boisson
      })

      // accomp
      accompObj = supplementsList["hydra:member"].find(supp => {
        return supp.name === accomp
      })

      sauceObj = ingredientsList["hydra:member"].find(ing => {
        return ing.name === sauce
      })

      if(menuObj && boissonObj && accompObj && sauceObj) {
        if(boissonObj.category === '/api/product_categories/1'
          && accompObj.category === '/api/product_categories/2'
          && sauceObj.type === 'sauce') {

            sandwichObj = supplementsList["hydra:member"].find(supp => {
              return supp["@id"] === menuObj.sandwich
            })

            menuObj.content = [boissonObj["@id"], accompObj["@id"], sandwichObj["@id"]]
            menuObj.comment = comment
            panier["menus"].push(menuObj)
            msg.reply("Menu "+menuObj.name+" ajouté au panier ! :smile:")
          } else {
            msg.reply("Attention à l'ordre des éléments du menus ! ?Menu - ?Boisson - ?Accompagnement - ?Sauce - ?Mot pour le chef :smile:")
          }
      } else {
        sendUnknown(msg)
      }
    } else if(parts.length == 2) {
      let suppObj = parts[1]
      suppObject = supplementsList["hydra:member"].find(supp => {
        return supp.name === suppObj
      })
      if(suppObject) {
        panier["supplements"].push(suppObject)
        msg.reply(suppObject.name+" ajouté au panier ! :smile:")
      } else {
        sendUnknown(msg)
      }
    } else {
      msg.reply("Je ne comprends pas ce que tu veux, réfère toi au manuel si besoin :smile:")
    }
  }
}

function writeRules() {
  let tutorialChannel = client.channels.cache.get("686976432009642047")
  tutorialChannel.send("Si tu n'as jamais commandé, voici les instructions à utiliser, bonne lecture :smile:")

  let embed = new MessageEmbed()
    .setTitle('Tutoriel')
    .setColor(0xff0000);

  embed.addField("Pour commencer à commander", "Tape !commande")
  embed.addField("Pour voir ton panier", "Tape !panier")
  embed.addField("Pour vider ton panier", "Tape !vider")
  embed.addField("Pour afficher les menus", "Tape !menus")
  embed.addField("Pour afficher les suppléments", "Tape !supplements")
  embed.addField("Pour ajouter un supplément à ta commande", "Tape ?nomSupplément par exemple ?Orangina")
  embed.addField("Pour ajouter un supplément à ta commande", "Tape ?nomMenu ?nomBoisson ?nomAccompagnement ?nomSauce ?motAuChef par exemple ?Classique ?Coca Cola ?Frites ?sauce blanche ?Pas trop cuit stp chef")
  embed.addField("Pour valider ta commande", "Tape !valider")

  tutorialChannel.send(embed)
  tutorialChannel.send("Bon apétit ! :smile:")
}

let rawdata = fs.readFileSync('sentences.json');
let sentences = JSON.parse(rawdata);

const client = new Client();

let app = express();

app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(bodyParser.json());

app.post('/bot/updateState', function(req, res) {
  let user = client.users.cache.find(user => {
    return user.tag == req.body.username
  })

  switch(req.body.status) {
    case "ready":
      let activities = user.presence.activities
      if(activities.length != 0) {
        let gameName = activities[0].name
        message = "Arrête de jouer à "+gameName+" et viens chercher ta commande !"
      } else {
        message = sentences.states[req.body.status]
      }
    break;
    default:
      message = sentences.states[req.body.status]
  }

  user.createDM().then(channel => {
    channel.send(message)
  })

  res.send(user)
});

client.on('ready', () => {
    client.user.setActivity("Kebab Maker")
    let generalChannel = client.channels.cache.get("686991603273170957")
    //generalChannel.send("Début du service !")

    menusList = getMenus()
    supplementsList = getSupplement()

    //writeRules();
})

client.on('message', msg => {
  if(msg.channel.type !== 'dm') {
    switch (msg.content) {
      case "!commande":
        sendDM(msg)
        break;
    }
  } else {
    switch (msg.content) {
      case "!menus":
        sendMenus(msg)
        break;
      case "!supplements":
        sendSupplements(msg)
        break;
      case "!panier":
        sendPanier(msg)
        break;
      case "!valider":
        sendValidate(msg)
        break;
      case "!vider":
        resetShop(msg)
        break;
      case "!test":
        break;
      default:
        if(msg.content !== '?') {
          processDefault(msg)
        }
    }
  }
});

client.login('Njg2MzExMTk5NTI4MzIxMTQx.XmVaFQ.PblsUfDthzMPB0SUCXrwXeIJWXk');

app.listen(8088);
console.log('Bot is running');
