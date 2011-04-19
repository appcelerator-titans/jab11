controller = {
    actions: {
        list: function() {
            return AirView(this.get());
        },
        details: function(id) {
            return AirView(this.get(id));
        },
        get: function(id) {
            var jab = TiStorage().use('jab');
            var program = jab.collection('Program');
            var programDetails = jab.collection('ProgramDetails');
            // if we don't have anything in our database, load in the default data.
            if (program.find().length == 0) {
                this.handlePayload(program, AirModel('defaultProgram'));
            }
            if (id == undefined) {
                return program.find();
            }
            else {
                var specificEvent = program.find({ id: id })[0];
                specificEvent.Details = programDetails.find({ guid: specificEvent.TitleLink })[0];
                return specificEvent;
            }
        },
        update: function(callback) {

            var program = TiStorage().use('jab').collection('Program');
            var self = this;
            var xhr = new HTTPClient({
                onload: function() {
                    try {
                        var response = this.responseText;
                        if (response) {
                            program.clear();
                            self.handlePayload(program, response);
                            callback(program.find());
                        } else if (response.error) {
                            callback(response);
                        } else {
                            AirView('notification', 'The server is temporarily unavailable; please check your internet connection, and try again.');
                        }
                    }
                    catch(err) {
                        callback({ error: err });
                    }
                },
                onerror: function(e) {
                    callback({ error: e });
                }
            });
            xhr.open('GET', constants.ProgramUpdateURL);
            xhr.send();

        },
        handlePayload: function(collection, data) {
            var rows = data.substring(3, data.length - 3).split('"],["');
            for (var i = 0, l = rows.length; i < l; i++) {
                var cells = rows[i].split('","');
                collection.create({
                    GripPos: cells[0],
                    Start: cells[1],
                    StartFloat: parseFloat(cells[1].split(':').join('.')),
                    End: cells[2],
                    EndFloat: parseFloat(cells[2].split(':').join('.')),
                    Title: cells[3],
                    TitleLink: cells[4].split('\\/').join('/'),
                    UserName: cells[5],
                    UserLink: cells[6].split('\\/').join('/'),
                    Day: cells[7]
                });
            }
            var n = new Date();
            var timestamp = '' + n.getUTCFullYear() + toTwoDigits(n.getUTCMonth() + 1) + toTwoDigits(n.getUTCDate()) + toTwoDigits(n.getUTCHours());
            var query = 'SELECT guid,description FROM feed WHERE url="http://jandbeyond.org/attendees/proposed-talks-and-sessions.feed?start={START}&export=json?t=' + timestamp + '"';

            var programDetails = TiStorage().use('jab').collection('ProgramDetails');
            function downloadProgramDetails(start) {
                var percent = start / rows.length;
                if (percent > 1) {
                    percent = 1;
                }
                AirView('notification', 'Downloading details: ' + parseInt(percent * 100, 0) + '%');
                Ti.Yahoo.yql(query.split('{START}').join(start), function(response) {
                    if (!response.success) {
                        AirView('notification', 'Interrupted while downloading details!');
                    }
                    else {
                        if (response.data) {
                            var data = response.data;
                            for (var j = 0, k = data.item.length; j < k; j++) {
                                var item = data.item[j];
                                item.description = item.description.replace(/K2Feed/gi, 'item');
                                programDetails.create(item);
                            }
                            downloadProgramDetails(start + 10);
                        }
                        else {
                            // we're done!
                            AirView('notification', 'Downloading details: Complete!');
                        }
                    }
                });
            }

            programDetails.clear();
            downloadProgramDetails(0);
        }
    }
};