function authentificate() {
  return gapi.auth2.getAuthInstance()
      .signIn({scope: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events"})
      .then(function() { console.log("Sign-in successful"); },
            function(err) { console.error("Error signing in", err); });
}

function loadClient() {
  gapi.client.setApiKey("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");
  return gapi.client.load("https://content.googleapis.com/discovery/v1/apis/calendar/v3/rest")
      .then(function() { console.log("GAPI client loaded for API"); },
              function(err) { console.error("Error loading GAPI client for API", err); });
}

function execute(calendar) {
  for (let i = 0; i < calendar.length; i++) {
    return gapi.client.calendar.events.insert({
      "calendarId": "primary",
      "sendNotifications": true,
      "sendUpdates": "all",
      "supportsAttachments": true,
      "resource": {
        "start": {
          "dateTime": calendar[i].start,
          "timeZone": "France/Paris"
        },
        "end": {
          "dateTime": calendar[i].end,
          "timeZone": "France/Paris"
        },
        "summary": calendar[i].titlemodule + " >> " + calendar[i].acti_title,
        "location": `Room: ${calendar[i].room.code == null ? "Bureau" : calendar[i].room.code.split("/")[calendar[i].room.code.split("/").length - 1]}`,
        "reminders": {
          "useDefault": false,
          "overrides": [
            {
              "method": "popup",
              "minutes": 60
            }
          ]
        },
        "source": {
          "url": `https://intra.epitech.eu/module/${calendar[i].scolaryear}/${calendar[i].codemodule}/${calendar[i].codeinstance}/${calendar[i].codeacti}/`,
          "title": "Voir sur l'intra"
        }
      }
    }).then(function(response) {
      console.log("Response", response);
    },
    function(err) { console.error("Execute error", err); });
  }
}

gapi.load("client:auth2", function() {
  gapi.auth2.init({client_id: "521303016563-5mvktgv72i3utq8bt0b0j6n4k9k4dk3c.apps.googleusercontent.com"});
});