import React, { Component } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { HubConnection } from '@aspnet/signalr-client';

import { getUserMedia, RTCIceCandidate, RTCPeerConnection, RTCSessionDescription, RTCView } from 'react-native-webrtc';

const configuration = { "iceServers": [ { "url": "stun:stun.l.google.com:19302" } ] };

function logError(error) {
    console.log("logError", error);
}

function getLocalStream(isFront, callback) {
    let videoSourceId;

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

function createPC(isOffer, conn, myGroup, interlocGroup, addRemoteStreamCallback) {
    const pc = new RTCPeerConnection(configuration);

    pc.onicecandidate = (e) => {
        console.log('onicecandidate', e.candidate);

        if (e.candidate) {
            conn.invoke("SendCandidate", interlocGroup, e.candidate);
        }
    };

    function createOffer() {
        pc.createOffer().then(pc.setLocalDescription).then(() => {
            console.log("DESCRIPTION", pc.localDescription);

            conn.invoke("SendOffer", interlocGroup, myGroup, pc.localDescription);
        });
    }

    pc.onnegotiationneeded = function () {
        console.log('onnegotiationneeded');
        if (isOffer) createOffer();
    };

    pc.onaddstream = function (event) {
        addRemoteStreamCallback(event.stream.toURL());
    };

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

        this.pc = createPC(true, this.connection, this.state.myGroup, this.state.recGroup, this.onAddRemoteStream);
    };

    onNewOffer = (callerGroup, sdp) => {
        this.pc = createPC(false, this.connection, '', callerGroup, this.onAddRemoteStream);

        this.pc.setRemoteDescription(new RTCSessionDescription(sdp)).then(() => {

            this.pc.createAnswer().then(this.pc.setLocalDescription).then(() => {
                console.log("DESCRIPTION", this.pc.localDescription);

                this.connection.invoke("SendAnswer", callerGroup, pc.localDescription);
            });

        });
    };

    onNewAnswer = (sdp) => {
        this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    };

    onNewCandidate = (ice) => {
        this.pc.addIceCandidate(new RTCIceCandidate(ice));
    };

    componentDidMount() {
        this.connection = new HubConnection("http://192.168.1.207:5001/signaling");

        this.connection.on('NewOffer', this.onNewOffer);
        this.connection.on('NewAnswer', this.onNewAnswer);
        this.connection.on('NewCandidate', this.onNewCandidate);

        this.connection.start();

        getLocalStream(true, (stream) => {
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
