(function () {
  'use strict';

  angular
    .module('ga.lidtoevoegencontroller', ['ga.services.alert', 'ga.services.dialog'])
    .controller('LidToevoegenController', LidToevoegenController);

  LidToevoegenController.$inject = ['$scope', '$location', '$timeout', '$window', '$http', 'CacheService', 'LidService',
    'RestService', 'AlertService', 'DialogService', '$rootScope', '$route', 'access', 'FormValidationService'];

  function LidToevoegenController($scope, $location, $timeout, $window, $http, CS, LS, RestService, AlertService, DialogService, $rootScope, $route, access, FVS) {

    $scope.formInitiated = false;
    $scope.functiesEnGroepenGeladen = false;

    var aangemeldeGebruiker = {};
    if (!access) {
      $location.path("/lid/profiel");
    }

    var init = function () {
      // TODO - controle of de gebruiker wel nieuwe leden kan maken
      //        => anders redirect naar ledenlijst

      // huidige gebruiker opvragen, om de secties te kunnen bekijken die de gebruiker mag mee sturen

      RestService.Lid.get({id: 'profiel'}).$promise.then(
        function (result) {
          aangemeldeGebruiker = result;
          $scope.patchObj = $.grep(aangemeldeGebruiker.links, function (e) {
            return e.method == "PATCH";
          })[0];
        },
        function (error) {
        }
      );

      $scope.dateOptions = {
        formatYear: 'yyyy',
        startingDay: 1,
        datepickerMode: 'year'
      };
      $scope.popupCal = {
        opened: false
      };
      $scope.popupCal = function () {
        $scope.popupCal.opened = true;
      };
      $scope.formats = ['dd/MM/yyyy'];
      $scope.format = $scope.formats[0];

      $scope.suggesties = [];

      // used by errorbutton
      $scope.lidPropertiesWatchable = true;

      /*
       * Initialisatie van het nieuwe lid model
       * ---------------------------------------
       */
      var lid = {};
      lid.functies = [];
      lid.changes = [];
      lid.persoonsgegevens = {};
      lid.persoonsgegevens.geslacht = "vrouw";
      lid.email = null;
      lid.gebruikersnaam = null;
      lid.vgagegevens = {};
      lid.contacten = [];
      lid.adressen = [];
      lid.adressen[0] = {
        land: "BE",
        postadres: true,
        omschrijving: "",
        id: 'tempadres' + Date.now(),
        bus: null
      };

      if ($rootScope.defaultLid) {
        $scope.lidaanvraag = $rootScope.defaultLid.lidaanvraag;
        delete $rootScope.defaultLid.lidaanvraag;

        angular.extend(lid, $rootScope.defaultLid);

        angular.forEach(lid.adressen, function (adres) {
          var randomId = "" + Date.now();
          angular.forEach(lid.contacten, function (contact, key) {
            if (adres.id == contact.adres) {
              contact.adres = randomId;
            }
            contact.id = key;
          });
          adres.id = randomId;
        });

        delete $rootScope.defaultLid;
      }

      lid.vgagegevens.verminderdlidgeld = lid.vgagegevens.verminderdlidgeld || false;
      lid.vgagegevens.beperking = lid.vgagegevens.beperking || false;

      $scope.lid = lid;
      $scope.lid.adressen[0].showme = true;

      if ($scope.lidaanvraag) {
        $scope.updateSuggesties();
      }

      /*
       * Initialisatie van andere benodigdheden.
       * ---------------------------------------
       */
      // functies ophalen enkel voor de groepen waarvan de gebruiker vga is
      CS.Functies().then(
        function (result) {
          $scope.functies = result;
          CS.Groepen().then(
            function (result) {
              //herordenen zodat ze eenvoudig gebruikt kunnen worden in de template;
              $scope.groepEnfuncties = [];
              angular.forEach(result.groepen, function (value) {
                var tempGroep = {};
                tempGroep.functies = [];
                tempGroep.groepsnummer = value.groepsnummer;
                tempGroep.groepseigenGegevens = value.groepseigenGegevens;
                tempGroep.naam = value.naam;
                angular.forEach($scope.functies.functies, function (value2) {
                  if (value2.groepen.indexOf(value.groepsnummer) != -1) {
                    tempGroep.functies.push(value2);
                  }
                });
                $scope.groepEnfuncties.push(tempGroep);
              });
              $scope.functiesEnGroepenGeladen = true;
            }
          );
        }
      );

      $timeout(function () {
        $scope.formInitiated = true;
      }, 4000);
    };

    /*
     * Controle ofdat de sectie aangepast mag worden.
     * ---------------------------------------
     */
    $scope.hasPermission = function (val) {
      if ($scope.patchObj) {
        return $scope.patchObj.secties.indexOf(val) > -1;
      }
    };

    function setChanges() {
      if ($scope.nieuwLidForm.$dirty) {
        $window.onbeforeunload = unload;
      }
    }

    angular.forEach(['lid.persoonsgegevens', 'lid.email', 'lid.gebruikersnaam', 'lid.contacten', 'lid.adressen', 'lid.functies'], function (value) {
      $scope.$watch(value, setChanges, true);
    });

    $scope.changePostadres = function (adresID) {
      angular.forEach($scope.lid.adressen, function (value) {
        value.postadres = value.id == adresID;
      });
    };

    /*
     * Contacten
     * ---------------------------------------
     */

    // contacten wissen in het model
    $scope.deleteContact = function (contactID) {
      var contactIndex;
      angular.forEach($scope.lid.contacten, function (value, index) {
        if (value.id == contactID) {
          contactIndex = index;
        }
      });
      $scope.lid.contacten.splice(contactIndex, 1);
    };

    // nieuw contact toevoegen aan het model
    $scope.contactToevoegen = function (formIsValid) {
      if (formIsValid) {
        var newcontact = {
          'rol': 'moeder',
          'adres': $scope.lid.adressen[0].id,
          'id': '' + Date.now()
        };
        $timeout(function () {
          newcontact.showme = true
        }, 0);
        $scope.lid.contacten.push(newcontact);

      } else {
        AlertService.add('danger', "Nieuwe contacten kunnen pas worden toegevoegd wanneer alle andere formuliervelden correct werden ingevuld.");
      }
    };

    /*
     * Adressen
     * ---------------------------------------
     */
    // een adres toevoegen aan het lid model
    $scope.addAdres = function (formIsValid) {
      if (formIsValid) {
        var newadres = {
          land: "BE",
          postadres: false,
          omschrijving: "",
          id: 'tempadres' + Date.now(),
          bus: null
        };
        if (!_.find($scope.lid.adressen, {postadres: true})) {
          newadres.postadres = true;
        }
        var lid = {};
        lid.id = $scope.lid.id;
        lid.adressen = $scope.lid.adressen;
        lid.adressen.push(newadres);

      } else {
        AlertService.add('danger', "Nieuwe adressen kunnen pas worden toegevoegd wanneer alle andere formuliervelden correct werden ingevuld.");
      }
    };

    // een adres wissen in het lid model
    $scope.deleteAdres = function (adresID) {
      var wisindex;
      angular.forEach($scope.lid.adressen, function (value, index) {
        if (value.id == adresID) {
          //controle wissen van adres gekoppeld aan een contact
          var kanwissen = true;
          angular.forEach($scope.lid.contacten, function (contact) {
            if (contact.adres == adresID) {
              AlertService.add('danger', "Dit adres is nog gekoppeld aan een contact, het kan daarom niet gewist worden.");
              kanwissen = false;
            }
          });
          if (kanwissen) {
            $scope.lid.adressen.splice(index, 1);
            wisindex = index;
            kanwissen = true;
          }
        }
      });
    };

    // zoek gemeentes
    $scope.zoekGemeente = function (zoekterm) {
      return LS.zoekGemeente(zoekterm);
    };

    // gemeente opslaan in het adres
    $scope.bevestigGemeente = function (item, adres) {
      adres.postcode = item.substring(0, 4);
      adres.gemeente = item.substring(5);
    };

    // zoek straten en giscodes
    $scope.zoekStraat = function (zoekterm, adres) {
      var resultaatStraten = [];
      return RestService.Code.query({zoekterm: zoekterm, postcode: adres.postcode}).$promise.then(
        function (result) {
          angular.forEach(result, function (val) {
            resultaatStraten.push(val);
          });
          return resultaatStraten;
        });
    };

    // straat en giscode opslaan in het adres
    $scope.bevestigStraat = function (item, adres) {
      adres.straat = item.straat;
      adres.giscode = item.code;

    };

    /*
     * Functies
     * ---------------------------------------
     */

    // nieuwe functie toevoegen aan model
    $scope.functieToevoegen = function (groepsnummer, functie, type) {
      $scope.functieInstantiesError = false;
      if (type == 'add') {
        var functieInstantie = {};
        functieInstantie.functie = functie;
        functieInstantie.groep = groepsnummer;


        functieInstantie.begin = '2016-01-01T00:00:00.000+01:00'; // set static date
        functieInstantie.temp = "tijdelijk";

        $scope.lid.functies.push(functieInstantie);
        return 'stop';
      }
      else {
        angular.forEach($scope.lid.functies, function (value, key) {
          if (value.groep == groepsnummer && value.functie == functie && value.temp == "tijdelijk") {
            $scope.lid.functies.splice(key, 1);
          }
        });
        return 'add'
      }
    };

    /*
     * Opslaan van het nieuwe lid
     * ---------------------------------------
     */

    $scope.opslaan = function () {
      $scope.saving = true;
      var origineelLid = {};
      angular.copy($scope.lid, origineelLid);
      //lid voorbereiden voor verzenden
      if (origineelLid.functies.length > 0) {
        origineelLid.functies = [];
        origineelLid.functies.push($scope.lid.functies[0]);
      } else {
        origineelLid.functies = [];
      }

      RestService.LidAdd.save(origineelLid).$promise.then(
        function (response) {
          if ($scope.lidaanvraag) {
            $http({
              url: $scope.lidaanvraag.href,
              method: $scope.lidaanvraag.method
            })
          }

          if ($scope.lid.functies.length > 1) {
            var patchDeel = {};
            patchDeel.functies = $scope.lid.functies.splice(1, $scope.lid.functies.length - 1);

            RestService.Lid.update({id: response.id}, patchDeel).$promise.then(
              function (response) {
                $scope.nieuwLidForm.$setPristine();
                $location.path("/lid/" + response.id);
                $scope.saving = false;
                AlertService.add('success ', "Lid toegevoegd");
              },
              function (error) {
                $scope.saving = false;
                AlertService.add('danger', error);
              }
            );
          } else {
            $scope.nieuwLidForm.$setPristine();
            $location.path("/lid/" + response.id);
            $scope.saving = false;
            AlertService.add('success ', "Lid toegevoegd");
          }
        },
        function (error) {
          $scope.saving = false;
          if (error.status == 403) {
            AlertService.add('warning', error);
          }
          else if (error.data.fouten && error.data.fouten.length >= 1) {
            _.each(error.data.fouten, function (fout) {
              console.log("FOUT", fout);
              $scope[fout.veld + 'Error'] = true;
            });
          }
          else {
            AlertService.add('danger', error);
          }
        }
      );
    };

    /*
     * Header functionaliteit
     * ---------------------------------------
     */
    $scope.nieuw = function () {
      $route.reload();
    };

    /*
     * page Change functionaliteit
     * ---------------------------------------
     */
    // listener voor wanneer een gebruiker van pagina veranderd en er zijn nog openstaande aanpassingen.
    $scope.$on('$locationChangeStart', function (event, newUrl) {
      if ($scope.nieuwLidForm.$dirty) {
        event.preventDefault();
        DialogService.paginaVerlaten($scope.locationChange, newUrl);
      }
    });

    // return functie voor de bevestiging na het veranderen van pagina
    $scope.locationChange = function (result, url) {
      if (result) {
        $scope.nieuwLidForm.$setPristine();
        $scope.lid.changes = [];
        $window.location.href = url;
      }
    };

    $scope.checkField = function (formfield) {
      formfield.$setValidity(formfield.$name, FVS.checkField(formfield));
    };

    // TODO: REMOVE CODE DUPLICATION  (lidcontroller)

    $scope.$watch('nieuwLidForm.$valid', function (validity) {
      if ($scope.formInitiated == true) {
        if (!validity) {
          openAndHighlightCollapsedInvalidContacts();
          openAndHighlightCollapsedInvalidAdresses();
        } else {
          unHighlightInvalidContactsGroup();
          unHighlightInvalidAddressesGroup();
        }
      }
    });

    var openAndHighlightCollapsedInvalidContacts = function () {
      var invalidContacten = _.filter($scope.nieuwLidForm.$error.required, function (o) {
        return o.$name.indexOf('contacten') > -1;
      });
      _.each(invalidContacten, function (contact) {
        // get index from fieldname
        var str = contact.$name.match(/\d+/g, "") + '';
        var s = str.split(',').join('');
        // expand corresponding contact
        $scope.lid.contacten[s].showme = true;
        // hilight error
        $scope.lid.contacten[s].hasErrors = true;
      });
    };
    var openAndHighlightCollapsedInvalidAdresses = function () {
      var invalidAddresses = _.filter($scope.nieuwLidForm.$error.required, function (o) {
        return o.$name.indexOf('adressen') > -1;
      });
      _.each(invalidAddresses, function (adres) {
        // get index from fieldname
        var str = adres.$name.match(/\d+/g, "") + '';
        var s = str.split(',').join('');
        // expand corresponding adres
        $scope.lid.adressen[s].showme = true;
        // hilight error
        $scope.lid.adressen[s].hasErrors = true;
      });
    };
    var unHighlightInvalidContactsGroup = function () {
      if ($scope.lid && $scope.lid.contacten) {
        _.each($scope.lid.contacten, function (contact) {
          contact.hasErrors = false
        });
      }
    };
    var unHighlightInvalidAddressesGroup = function () {
      if ($scope.lid && $scope.lid.adressen) {
        _.each($scope.lid.adressen, function (adres) {
          adres.hasErrors = false
        });
      }
    };

    // END TO DO REMOVE DUPLICATE


    $scope.updateSuggesties = function () {
      return RestService.GelijkaardigZoeken.get({
        voornaam: $scope.lid.vgagegevens.voornaam,
        achternaam: $scope.lid.vgagegevens.achternaam
      }).$promise.then(function (result) {
        console.log(result.leden);

        if (0 < result.leden.length) {
          AlertService.add('warning', "Er zijn leden gevonden met een gelijkaardige naam. Ga naar het juiste lid of negeer dit bericht: ", result.leden);
        }
      });
    };

    // refresh of navigatie naar een andere pagina.
    var unload = function (e) {
      e.returnValue = "Er zijn nog niet opgeslagen wijzigingen. Ben je zeker dat je wil verdergaan?";
      return e.returnValue;
    };

    init();
  }
})();
