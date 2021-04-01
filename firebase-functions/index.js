const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp({ databaseURL: "https://[PROJECT_NAME].firebaseIO.com" });
const cors = require("cors")({ origin: eventfinity.co });
const attendeesCollection = admin.firestore().collection("managers");


// Fetches the top 25 scoring attendees:
exports.getLeaderboard = functions.https.onRequest((request, response) => {
    cors(request, response, async () => {
        const data = []
        const leaderboard = attendeesCollection.where('attendee_type', '==', 'manager').orderBy('points', 'desc').limit(25)
        await leaderboard.get().then((snapshot) => {
            snapshot.forEach(doc => {
                data.push(doc.data())
            });
            return response.send(data)
        })
            .catch(error => console.log(error));
    })
})

// Fetches leaderboard by team using query param: 
exports.getLeaderboardByDivision = functions.https.onRequest((request, response) => {
    cors(request, response, async () => {
        const leaderboardByDivision = await attendeesCollection.where('attendee_type', '==', 'manager').where('division', '==', request.query.division).orderBy('points', 'desc').limit(25).get()
        const data = []
        leaderboardByDivision.forEach((doc) => {
            data.push(doc.data())
        })
        response.send(data)
    })
})

// Fetches leaderboard by team using query param: 
exports.getLeaderboardByDistrict = functions.https.onRequest((request, response) => {
    cors(request, response, async () => {
        const leaderboardByDistrict = await attendeesCollection.where('attendee_type', '==', 'manager').where('district', '==', request.query.district).orderBy('points', 'desc').limit(25).get()
        const data = []
        leaderboardByDistrict.forEach((doc) => {
            data.push(doc.data())
        })
        response.send(data)
    })
})

// Checks Path booth visit requirements, and adds new attendee if not in db:
exports.checkPathStatus = functions.https.onRequest((request, response) => {
    cors(request, response, async () => {
        const attendeeId = request.query.attendee
        const attendee = attendeesCollection.doc(attendeeId)
        const newAttendee = request.body
        let pathStatus
        attendee.get().then((doc) => {
            if (doc.exists) {
                pathStatus = doc.data().path_complete
                console.log(`Checking status from EF for ${attendeeId}: ${pathStatus}`)
                response.status(200).send(pathStatus)
                if ( doc.data().points_path !== newAttendee.points_path ) { 
                    doc.ref.update({ points_path: newAttendee.points_path })
                    console.log(`${attendeeId} points_path updated to ${newAttendee.points_path}`)
                }
                if ( doc.data().district !== newAttendee.district ) { 
                    doc.ref.update({ district: newAttendee.district })
                    console.log(`${attendeeId} district updated to ${newAttendee.district}`)
                }
                if ( doc.data().division !== newAttendee.division ) { 
                    doc.ref.update({ division: newAttendee.division })
                    console.log(`${attendeeId} division updated to ${newAttendee.division}`)
                }
                if ( doc.data().first_name !== newAttendee.first_name ) { 
                    doc.ref.update({ first_name: newAttendee.first_name })
                    console.log(`${attendeeId} first_name updated to ${newAttendee.first_name}`)
                }
                if ( doc.data().last_name !== newAttendee.last_name ) { 
                    doc.ref.update({ last_name: newAttendee.last_name })
                    console.log(`${attendeeId} last_name updated to ${newAttendee.last_name}`)
                }
                return
            } else {
                console.log(`Adding new attendee: ${attendeeId}`)
                attendeesCollection.doc(newAttendee.event_attendee_id).set({
                    event_attendee_id: newAttendee.event_attendee_id,
                    first_name: newAttendee.first_name,
                    last_name: newAttendee.last_name,
                    attendee_type: (newAttendee.attendee_type).toLowerCase(),
                    district: newAttendee.district,
                    division: newAttendee.division,
                    points_path: (newAttendee.points_path).toLowerCase(),
                    path_complete: false,
                    points: 0
                })
                return response.status(200).send(false)
            }
        }).catch((error) => {
            console.log(error)
        })
        return
    })
})

// Checks Path booth visit requirements, and adds new attendee if not in db:
exports.checkPathStatusFromGame = functions.https.onRequest((request, response) => {
    cors(request, response, async () => {
        const attendeeId = request.query.attendee
        const attendee = attendeesCollection.doc(attendeeId)
        let pathStatus
        attendee.get().then((doc) => {
            if (doc.exists) {
                pathStatus = doc.data().path_complete
                console.log(`Checking status from game for ${attendeeId}: ${pathStatus}`)
                return response.status(200).send(pathStatus)
            } else {
                console.log(`Checking status from game: ${attendeeId} not in database`)
                return response.status(200).send(false)
            }
        }).catch((error) => {
            console.log(error)
        })
        return
    })
})

// Records Platinum booth visits, and awards points for 26th booth visit:
exports.recordPlatinumVisit = functions.https.onRequest((request, response) => {
    cors(request, response, async () => {
        const attendeeId = request.query.attendee
        const attendee = attendeesCollection.doc(attendeeId)
        const boothId = request.query.booth
        const newAttendee= request.body
        attendee.get().then((doc) => {
            if (doc.exists) {   
                attendee.collection('platinumVisits').doc(boothId).get().then((doc) => {
                    if (!doc.exists) {
                        attendee.collection('platinumVisits').get().then(snap => {
                            if (snap.size === 17) {
                                attendee.update({ points: 1800, path_complete: true })
                                attendee.collection('platinumVisits').doc(boothId).set({ visited: boothId })
                                console.log(`Attendee ${attendeeId} has fulfilled Platinum requirments: check for 1800 points/true`)
                            } else {
                                attendee.collection('platinumVisits').doc(boothId).set({ visited: boothId })
                                console.log(`Attendee ${attendeeId} Platinum visit recorded`)
                            }
                        }).catch(error => console.log(error))
                    } else { 
                        console.log(`Attendee ${attendeeId} has already visited this Platinum booth`)
                    }
                }).catch(error => console.log(error))
            } else {
                console.log(`Adding new attendee on Platinum path: ${newAttendee.event_attendee_id} ${newAttendee.first_name} ${newAttendee.last_name}`)
                attendeesCollection.doc(attendeeId).set({
                    event_attendee_id: newAttendee.event_attendee_id,
                    first_name: newAttendee.first_name,
                    last_name: newAttendee.last_name,
                    attendee_type: (newAttendee.attendee_type).toLowerCase(),
                    district: newAttendee.district,
                    division: newAttendee.division,
                    points_path: (newAttendee.points_path).toLowerCase(),
                    path_complete: false,
                    points: 0
                })
                attendeesCollection.doc(attendeeId).collection('platinumVisits').doc(boothId).set({ visited: boothId })
                return newAttendee
            }
        }).catch((error) => {
            console.log(error)
        })
        return response.status(200).send("platinum visit processed")    
    })
})

// Records Canada booth visits, and awards points for 26th booth visit:
exports.recordCanadaVisit = functions.https.onRequest((request, response) => {
    cors(request, response, async () => {
        const attendeeId = request.query.attendee
        const attendee = attendeesCollection.doc(attendeeId)
        const boothId = request.query.booth
        const newAttendee = request.body
        attendee.get().then((doc) => {
            if (doc.exists) {   
                attendee.collection('canadaVisits').doc(boothId).get().then((doc) => {

                    if (!doc.exists) {
                        attendee.collection('canadaVisits').get().then(snap => {
                            if (snap.size === 6) {
                                attendee.update({ points: 210, path_complete: true })
                                attendee.collection('canadaVisits').doc(boothId).set({ visited: boothId })
                                console.log(`Attendee ${attendeeId} has fulfilled Canada requirments: check for 210 points/true`)
                            } else {
                                attendee.collection('canadaVisits').doc(boothId).set({ visited: boothId })
                                console.log(`Attendee ${attendeeId} Canada visit recorded`)
                            }
                        }).catch(error => console.log(error))
                    } else { 
                        console.log(`Attendee ${attendeeId} has already visited this Canada booth`)
                    }
                }).catch(error => console.log(error))
            } else {
                console.log(`Adding new attendee on Canada path: ${attendeeId}`)
                attendeesCollection.doc(newAttendee.event_attendee_id).set({
                    event_attendee_id: newAttendee.event_attendee_id,
                    first_name: newAttendee.first_name,
                    last_name: newAttendee.last_name,
                    attendee_type: (newAttendee.attendee_type).toLowerCase(),
                    district: newAttendee.district,
                    division: newAttendee.division,
                    points_path: (newAttendee.points_path).toLowerCase(),
                    path_complete: false,
                    points: 0
                })
                attendeesCollection.doc(attendeeId).collection('canadaVisits').doc(boothId).set({ visited: boothId })
                return newAttendee
            }
        }).catch((error) => {
            console.log(error)
        })
        return response.status(200).send("canada visit processed")  
    })
})

// Records Floorcovering booth visits, and awards points for 26th booth visit:
exports.recordFloorcoveringVisit = functions.https.onRequest((request, response) => {
    cors(request, response, async () => {
        const attendeeId = request.query.attendee
        const attendee = attendeesCollection.doc(attendeeId)
        const boothId = request.query.booth
        const newAttendee = request.body
        attendee.get().then((doc) => {
            if (doc.exists) {   
                attendee.collection('floorcoveringVisits').doc(boothId).get().then((doc) => {
                    if (!doc.exists) {
                        attendee.collection('floorcoveringVisits').get().then(snap => {
                            if (snap.size === 14) {
                                attendee.update({ points: 850, path_complete: true })
                                attendee.collection('floorcoveringVisits').doc(boothId).set({ visited: boothId })
                                console.log(`Attendee ${attendeeId} has fulfilled Floorcovering requirments: check for 850 points/true`)
                            } else {
                                attendee.collection('floorcoveringVisits').doc(boothId).set({ visited: boothId })
                                console.log(`Attendee ${attendeeId} Floorcovering visit recorded`)
                            }
                        }).catch(error => console.log(error))
                    } else { 
                        console.log(`Attendee ${attendeeId} has already visited this Floorcovering booth`)
                    }
                }).catch(error => console.log(error))
            } else {
                console.log(`Adding new attendee on Floorcovering path: ${attendeeId}`)
                attendeesCollection.doc(newAttendee.event_attendee_id).set({
                    event_attendee_id: newAttendee.event_attendee_id,
                    first_name: newAttendee.first_name,
                    last_name: newAttendee.last_name,
                    attendee_type: (newAttendee.attendee_type).toLowerCase(),
                    district: newAttendee.district,
                    division: newAttendee.division,
                    points_path: (newAttendee.points_path).toLowerCase(),
                    path_complete: false,
                    points: 0
                })
                attendeesCollection.doc(attendeeId).collection('floorcoveringVisits').doc(boothId).set({ visited: boothId })
                return newAttendee
            }
        }).catch((error) => {
            console.log(error)
        })
        return response.status(200).send("floorcovering visit processed")  
    })
})

// Checks to see if points have been awarded for action, and awards points if not:
exports.addPoints = functions.https.onRequest((request, response) => {
    cors(request, response, async () => {
        const attendeeId = request.query.attendee
        const attendee = attendeesCollection.doc(attendeeId)
        const awardedId = request.query.awarded
        const awarded = attendee.collection("awarded").doc(awardedId)
        const pointsToAdd = parseInt(request.query.points)
        attendee.get().then((doc) => {
            if (doc.exists) {
                const currentPoints = parseInt(doc.data().points)
                awarded.get().then((doc) => {
                    if (doc.exists) {
                        console.log(`${attendeeId} has already received points for ${awardedId}`)
                        return response.status(200).send("points already awarded for this action")
                    } else {
                        const newPointsTotal = currentPoints + pointsToAdd
                        console.log(`Adding ${pointsToAdd} points to ${attendeeId} for ${awardedId}. New points total: ${newPointsTotal}`)
                        attendee.update({ points: newPointsTotal })
                        attendee.collection('awarded').doc(awardedId).set({ awarded: awarded })
                        return response.status(200).send("points added!")
                    }
                }).catch((error) => {
                    console.log(error)
                })
            } else {
                console.log(`Trying to add points but ${attendeeId} not in database`)
                return
            }
        }).catch((error) => {
            console.log(error)
        })
        return 
    })
})

// Attendee passed as query param ie '?event_attendee_id=299492847' 
exports.getAttendee = functions.https.onRequest((request, response) => {
    cors(request, response, async () => {
        const attendeeId = request.query.attendee
        const attendee = attendeesCollection.doc(attendeeId);
        attendee.get().then((doc) => {
            if (doc.exists) {
                console.log(`${attendeeId}`)
                return response.status(200).send(doc.data())
            } else {
                console.log(`${attendeeId} not in database`)
                return response.status(200).send("attendee not yet in database")
            }
        }).catch((error) => {
            console.log(error);
        });
    })
})