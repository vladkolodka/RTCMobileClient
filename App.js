import React, { Component } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { HubConnection } from '@aspnet/signalr-client';

import { getUserMedia, RTCIceCandidate, RTCPeerConnection, RTCSessionDescription, RTCView, MediaStreamTrack } from 'react-native-webrtc';

const configuration = { "iceServers": [ { "url": "stun:stun.l.google.com:19302" } ] };

function logError(error) {
    console.log("logError", error);
}

function getLocalStream(isFront, callback) {
    let videoSourceId;

    if (Platform.OS === 'ios') {
        MediaStreamTrack.getSources(sourceInfos => {
            console.log("sourceInfos: ", sourceInfos);

            for (let i = 0; i < sourceInfos.length; i++) {
                const sourceInfo = sourceInfos[i];
                if(sourceInfo.kind === "video" && sourceInfo.facing === (isFront ? "front" : "back")) {
                    videoSourceId = sourceInfo.id;
                }
            }
        });
    }

    getUserMedia({
        audio: true,
        video: {
            mandatory: {
                minWidth: 400,
                minHeight: 640,
                minFrameRate: 30,
            },
            facingMode: (isFront ? "user" : "environment"),
            optional: (videoSourceId ? [ { sourceId: videoSourceId } ] : [])
        }
    }, function (stream) {
        console.log('getUserMedia success', stream);
        callback(stream);
    }, logError);
}

function createPC(isOffer, conn, myGroup, interlocGroup, stream, addRemoteStreamCallback) {
    const pc = new RTCPeerConnection(configuration);

    pc.onicecandidate = (e) => {
        console.log('onicecandidate', e.candidate);

        if (e.candidate) {
            conn.invoke("SendCandidate", interlocGroup, JSON.stringify(e.candidate));
        }
    };

    function createOffer() {
        pc.createOffer().then(pc.setLocalDescription).then(() => {
            console.log("OFFER", pc.localDescription);

            conn.invoke("SendOffer", interlocGroup, myGroup, JSON.stringify(pc.localDescription));
        });
    }

    pc.onnegotiationneeded = function () {
        console.log('onnegotiationneeded');
        if (isOffer) createOffer();
    };

    pc.onaddstream = function (event) {
        console.log("ADD REMOTE STREAM");
        addRemoteStreamCallback(event.stream.toURL());
    };

    pc.addStream(stream);

    return pc;
}

export default class App extends Component {
    state = {
        myGroup: 'a',
        recGroup: 'b',
        myStreamUrl: '',
        remoteStreamUrl: ''
    };

    onChangeMyGroup = (text) => this.setState({ myGroup: text });
    onChangeRepGroup = (text) => this.setState({ recGroup: text });

    onJoinGroup = () => {
        if (this.state.myGroup === '') return;

        this.connection.invoke('JoinGroup', this.state.myGroup);
    };

    onAddRemoteStream = (url) => this.setState({
        remoteStreamUrl: url
    });

    onCall = () => {
        if (this.state.recGroup === '') return;

        this.pc = createPC(true, this.connection, this.state.myGroup, this.state.recGroup, this.stream, this.onAddRemoteStream);
    };

    onNewOffer = (callerGroup, sdp) => {
        this.pc = createPC(false, this.connection, '', callerGroup, this.stream, this.onAddRemoteStream);

        this.pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(sdp))).then(() => {
            console.log("SET REMOTE DESCRIPTION");

            this.pc.createAnswer((desc) => {
                console.log('createAnswer', desc);
                this.pc.setLocalDescription(desc, () => {
                    console.log('setLocalDescription', this.pc.localDescription);
                    this.connection.invoke('SendAnswer', callerGroup, JSON.stringify(this.pc.localDescription));
                }, logError);
            }, logError);
            // this.pc.createAnswer().then(this.pc.setLocalDescription).then(() => {
            //     console.log("ANSWER", this.pc.localDescription);
            //
            //
            //     this.connection.invoke("SendAnswer", callerGroup, JSON.stringify(pc.localDescription));
            // });

        });
    };

    onNewAnswer = (sdp) => {
        this.pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(sdp)));
    };

    onNewCandidate = (ice) => {
        this.pc.addIceCandidate(new RTCIceCandidate(JSON.parse(ice)));
    };

    componentDidMount() {
        this.connection = new HubConnection("http://192.168.1.207:5001/signaling");

        this.connection.on('NewOffer', this.onNewOffer);
        this.connection.on('NewAnswer', this.onNewAnswer);
        this.connection.on('NewCandidate', this.onNewCandidate);

        this.connection.start();

        getLocalStream(true, (stream) => {
            this.stream = stream;
            this.setState({ myStreamUrl: stream.toURL() });
        });
    }

    render() {
        return <View style={styles.container}>
            <View style={[ styles.row, {
                flex: 1
            } ]}>
                <View style={[ styles.col, {} ]}>
                    <Text>Me</Text>
                    <RTCView streamURL={this.state.myStreamUrl} style={{ flex: 1 }}/>
                </View>
                <View style={[ styles.col ]}>
                    <Text>Interlocutor</Text>
                    <RTCView streamURL={this.state.remoteStreamUrl} style={{ flex: 1 }}/>
                </View>
            </View>
            <View style={[ styles.row, {} ]}>
                <View style={[ styles.col ]}>
                    <Text>My group</Text>
                    <TextInput value={this.state.myGroup} onChangeText={this.onChangeMyGroup}/>
                    <Button title='Join' onPress={this.onJoinGroup}/>
                </View>
                <View style={[ styles.col ]}>
                    <Text>Interlocutor group</Text>
                    <TextInput value={this.state.recGroup} onChangeText={this.onChangeRepGroup}/>
                    <Button title='Call' onPress={this.onCall}/>
                </View>
            </View>
        </View>;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5FCFF',
    },
    welcome: {
        fontSize: 20,
        textAlign: 'center',
        margin: 10,
    },
    row: {
        flexDirection: 'row'
    },
    col: {
        flex: 1
    }
});
