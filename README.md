Inspired by https://github.com/bokub/ha-linky and https://github.com/hekmon/rtetempo

It's for french EDF consumption compute, so next will be in french

Le systeme tourne en background, et va importer plusieurs series de données
- 6 pour le mode tempo : linky_blue_hc_conso:PRM_NUMBER
- 2 pour le mode hc/hp : linky_standard_hc_conso:PRM_NUMBER
- 1 pour le mode standard : linky_standard_standard_conso:PRM_NUMBER

Pour chaque serie, on obtien aussi une serie dédié au pricing : linky_blue_hc_price:PRM_NUMBER

On peut alors configurer facilement chaque series dans la page energie de Home Assistant.


## Configuration
- Parametres > Modules complementaires > Boutique
- Cliquer sur le menu en haut a droite > Depots
- Ajouter ce repo : https://github.com/drappier-charles/ha-linky-tempo
- Ouvrez ensuite et installer : LinkyTempo
- Ouvrer le paneau de configuration et renseigner les differents parametres (detail en etape suivante)

## Liste des parametres
  ### Configuration de la connection au linky
  Vous pouvez generer un token ici : https://conso.boris.sh/
  Il permet de récupérer la consommation de votre compteur linky

  LINKY_PRM: Numero PRM de votre compteur Linky
  LINKY_TOKEN: Token récuperer sur l'api de conso

  ### Configuration de l'api Tempo
  Permet de recupérer le calendrier des jours tempo
  https://data.rte-france.com/catalog/-/api/consumption/Tempo-Like-Supply-Contract/v1.1
  Il faut creer un compte, une application, et activer l'api rte tempo
  Ensuite on peut generer un clientId / client Secret dans l'application
  TEMPO_CLIENT_ID: ClientId Tempo RTE API
  TEMPO_CLIENT_SECRET: ClientSecret Tempo RTE API

  ### Paramétrage simple
  INTERVAL: 7 
  Par defaut l'interval est a 7, tout le pulling est en heure, jamais en jour, donc eviter les trop gros chiffre (enedis a mis un quotas de request)
  De mon coté je n'ai pas eu de soucis a pull la data sur une longue periode une premiere fois, puis j'ai reduit ce chiffre a 3 (inutile de recuperer toute la donnée a chaque mise a jour)


  La suite est assez simple, il s'agit des prix, je les ai mis a jour en fevrier 2024, mais ils sont suceptible de bouger.
  Standard correspond au forfait classique EDF
  Standard HC et HP au forfait heure creuse/ heure pleine
  Et tous les autres au tempo

  TEMPO_PRICE_STANDARD: 0.2516
  TEMPO_PRICE_STANDARD_HC: 0.2068
  TEMPO_PRICE_STANDARD_HP: 0.27
  TEMPO_PRICE_BLUE_HC: 0.1296
  TEMPO_PRICE_BLUE_HP: 0.1609
  TEMPO_PRICE_WHITE_HC:  0.1486
  TEMPO_PRICE_WHITE_HP: 0.1894
  TEMPO_PRICE_RED_HC:  0.1568
  TEMPO_PRICE_RED_HP: 0.7562

  On peut aussi rajouter son prix mensuel d'abonnement, le chiffre par defaut est celui du tempo en 9kWh max

  EDF_MONTHLY_SUBSCRIPTION: 16.16



## How to launch it locally
On peut run le script localement, pour faire un premier import, si vous avez l'habitude de nodejs

On commence par install les deps (j'utilise yarn)
```sh
yarn
```

Puis on peut run le script assez facilement

```sh
LOG_LEVEL=debug \
LINKY_PRM=00000 \
LINKY_TOKEN="xxxx" \
TEMPO_CLIENT_ID="xxxx" \
TEMPO_CLIENT_SECRET="xxxx" \
SUPERVISOR_TOKEN="xxxx" \
WS_URL="ws://192.168.X.X:8123/api/websocket" \
PURGE='false' \
CACHE='true' \
INTERVAL=15 \
DRY_RUN='false' \
yarn start
```

Comme vous pouvez le voir certain parametre suplementaire apparaissent
- CACHE : si a 'true' la data pull sur les differentes api est mise en cache dans le dossier /data -> Pensez a les supprimer si vous changer l'INTERVAL ou si un jour est passé (pour la couleur des jours tempo)
- WS_URL : Url de connection a votre home assistant, le dns local ne marche pas chez moi, je met donc l'ip de mon serveur en dur
- SUPERVISOR_TOKEN : Ce token se genere dans home assistant, dans votre profil utilisateur -> Tout en bas
- PURGE : Si vous faites des tests, en mettant se parametre a 'true' toute la data sera suprimer sur HA, et vous pourrez le relancer a nouveau
- DRY_RUN : Encore lié au test, si la valeur est a 'true' la donnée ne sera pas envoyé sur HA