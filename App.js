import React, { Component } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { HubConnection } from '@aspnet/signalr-client';

export default class App extends Component {
    state = {
        connected: false,
        data: 'no data'
    };

    onConnect = () => {
        // let con = new HttpConnection();

        this.connection = new HubConnection("http://10.0.2.2:5001/signaling");

        this.connection.on('FromServerTest', (data) => this.setState({ connected: true, data: data }));

        this.connection.start();
    };

    onTest = () => {
        this.connection.invoke('Test');
    };

    render() {
        return (
            <View style={styles.container}>
                <Text style={styles.welcome}>Test state: {this.state.connected ? 'tested' : 'not tested'}</Text>
                <Text style={styles.welcome}>Data: {this.state.data}</Text>
                <Button title='Connect' onPress={this.onConnect}/>
                <Button title='Test' onPress={this.onTest}/>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5FCFF',
    },
    welcome: {
        fontSize: 20,
        textAlign: 'center',
        margin: 10,
    }
});
