import React from "react";
import { Events, Blockie, Scaler } from "dapparatus";
import Web3 from "web3";
import Ruler from "./Ruler";
import {CopyToClipboard} from "react-copy-to-clipboard";
import axios from "axios";
import * as connext from "@connext/client";
import * as types from "@connext/types";
import { Contract, ethers as eth } from "ethers";
import { AddressZero, Zero } from "ethers/constants";
import tokenArtifacts from "openzeppelin-solidity/build/contracts/ERC20Mintable.json";

import connextLogo from '../connext.jpg';

const { bigNumberify, parseEther, formatEther } = eth.utils


const QRCode = require('qrcode.react');

let interval

const toBN = (n) =>
  bigNumberify(n.toString());

const store = {
  get: (key) => {
    const raw = localStorage.getItem(`CF_NODE:${key}`)
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    }
    // Handle partial matches so the following line works -.-
    // https://github.com/counterfactual/monorepo/blob/master/packages/node/src/store.ts#L54
    if (key.endsWith("channel") || key.endsWith("appInstanceIdToProposedAppInstance")) {
      const partialMatches = {}
      for (const k of Object.keys(localStorage)) {
        if (k.includes(`${key}/`)) {
          try {
            partialMatches[k.replace('CF_NODE:', '').replace(`${key}/`, '')] = JSON.parse(localStorage.getItem(k))
          } catch {
            partialMatches[k.replace('CF_NODE:', '').replace(`${key}/`, '')] = localStorage.getItem(k)
          }
        }
      }
      return partialMatches;
    }
    return raw;
  },
  set: (pairs, allowDelete) => {
    for (const pair of pairs) {
      localStorage.setItem(
        `CF_NODE:${pair.key}`,
        typeof pair.value === 'string' ? pair.value : JSON.stringify(pair.value),
      );
    }
  }
};


export default class YourModule extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      yourVar: "",
      channel: false,
      depositAddr:null,
      balance:null,
      xPub:null,
      token:null,
      swapRate:null,
      YourContract: false,
      yourContractBalance: 0,
      toAddress: props.scannerState ? props.scannerState.toAddress : "",
      payAmount: "",
      withdrawOrDepositAmount: "",
      percent:1,
    };
  }

  async initConnext() {
    // set the client options

    let nodeUrl =  'wss://rinkeby.indra.connext.network/api/messaging'
    let ethProviderUrl =  `https://rinkeby.indra.connext.network/api/ethprovider`


      const mnemonic = localStorage.getItem("mnemonic");
  
      const options = {
        mnemonic,
        logLevel: 5,
        nodeUrl,
        ethProviderUrl,
        store
      };

      // instantiate a new instance of the client
      const channel = await connext.connect(options);

      
      if (channel) {
        const xPub = channel.publicIdentifier;
        const connextConfig = await channel.config();
        // const token = new Contract(connextConfig.contractAddresses.Token, tokenArtifacts.abi, cfWallet);
        // const swapRate = formatEther(await channel.getLatestSwapRate(AddressZero, token.address));
        console.log(`XPUB ${xPub}`)
        const depositAddr = connext.utils.publicIdentifierToAddress(xPub);
        console.log(`DEPOSIT ADDRESS DERIVED FROM XPUB ${depositAddr}`)
        this.setState({channel, depositAddr, xPub});
      }

    }

  componentWillUnmount(){
    clearInterval(interval)
  }
  
  loadMore(){
    let newPercent = this.state.percent+0.6
    if(newPercent>100) newPercent=100
    this.setState({percent:newPercent})
    this.exchangeIfNeeded()
  }
  componentDidMount() {
    console.log("YOUR MODULE MOUNTED, PROPS:", this.props);
    this.initConnext();
    interval = setInterval(this.loadMore.bind(this),1000)
  }

  async refreshBalances() {
    const { depositAddr, balance, channel, ethprovider, swapRate, token } = this.state;
    const freeEtherBalance = await channel.getFreeBalance();
    const freeTokenBalance = await channel.getFreeBalance(token.address);
    balance.ether = freeEtherBalance[this.state.freeBalanceAddress];
    balance.token = freeTokenBalance[this.state.freeBalanceAddress];
    this.setState({ balance });
  }


  async exchangeIfNeeded() {
    const {channel, balance, toSwap} = this.state;
    // const swapRate = (await channel.getLatestSwapRate(AddressZero, token.address));
    await this.refreshBalances();

    if(this.state && this.state.channel && this.state.balance &&
      typeof this.state.channel.swap == "function" &&
      balance.ether !== "0"){

        const payload = { 
          amount: toBN(toSwap),// in Wei, represented as bignumber
          toAssetId: "0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359", // Dai
          fromAssetId: AddressZero // ETH
        }
        
    channel.exchange(balance.ether,"wei");
    }
  }

  clicked(name) {
    console.log("secondary button " + name + " was clicked");
  }

  render() {

    if(!this.props.privateKey){
      return (
        <div>
          Sorry, this doesn't work with inject metamask yet. Open in incog without MM or other injected web3.
        </div>
      )
    }

    let connextState = "loading connext...";
    console.log("this.state.connext", this.state.connext);
    if (this.state.connext && this.state.connextInfo.persistent) {
      connextState = (
        <pre>{JSON.stringify(this.state.connextInfo.persistent, null, 2)}</pre>
      );
    }

    if(this.state.connextInfo&&this.state.connextInfo.persistent&&(this.state.connextInfo.persistent.channel.pendingWithdrawalTokenHub>0)){
      let shadowAmount = 100
      let shadowColor = "#faa31a"


      let inEthLong = this.props.web3.utils.fromWei(""+this.state.connextInfo.persistent.channel.pendingWithdrawalTokenHub,'ether')
      let balanceInEth = Math.round(inEthLong*10000)/10000

      let withdrawDisplay =(
        <div>
          Withdrawing {this.props.dollarDisplay(
            balanceInEth
          )}
          <img
            src={connextLogo}
            style={{ maxWidth: 22, maxHeight: 22 }}
          />
        </div>
      )

      return (
        <div style={{textAlign:'center'}}>
          {withdrawDisplay}
          <div style={{width:"100%",paddingTop:"5%",paddingBottom:"10%"}}>
            <img src ={this.props.loaderImage} style={{maxWidth:"25%",paddingBottom:"5%"}}/>
          </div>
          <div style={{width:"80%",height:1,backgroundColor:"#444444",marginLeft:"10%"}}>
            <div style={{width:this.state.percent+"%",height:1,backgroundColor:this.props.mainStyle.mainColorAlt,boxShadow:"0 0 "+shadowAmount/40+"px "+shadowColor+", 0 0 "+shadowAmount/30+"px "+shadowColor+", 0 0 "+shadowAmount/20+"px "+shadowColor+", 0 0 "+shadowAmount/10+"px #ffffff, 0 0 "+shadowAmount/5+"px "+shadowColor+", 0 0 "+shadowAmount/3+"px "+shadowColor+", 0 0 "+shadowAmount/1+"px "+shadowColor+""}}>
            </div>
          </div>
        </div>
      )
    }
    //check if pendingDepositWeiUser and show a loading bar
    if(this.state.connextInfo&&this.state.connextInfo.persistent&&(this.state.connextInfo.persistent.channel.pendingDepositWeiUser>0)){
      let shadowAmount = 100
      let shadowColor = "#faa31a"


      let inEthLong = this.props.web3.utils.fromWei(""+this.state.connextInfo.persistent.channel.pendingDepositWeiUser,'ether')
      let balanceInEth = Math.round(inEthLong*10000)/10000

      let depositDisplay =(
        <div>
          Depositing {this.props.dollarDisplay(
            balanceInEth * this.props.ethprice
          )}
          <img
            src={this.props.eth}
            style={{ maxWidth: 22, maxHeight: 22 }}
          />
          ({balanceInEth})
        </div>
      )

      return (
        <div style={{textAlign:'center'}}>
          {depositDisplay}
          <div style={{width:"100%",paddingTop:"5%",paddingBottom:"10%"}}>
            <img src ={this.props.loaderImage} style={{maxWidth:"25%",paddingBottom:"5%"}}/>
          </div>
          <div style={{width:"80%",height:1,backgroundColor:"#444444",marginLeft:"10%"}}>
            <div style={{width:this.state.percent+"%",height:1,backgroundColor:this.props.mainStyle.mainColorAlt,boxShadow:"0 0 "+shadowAmount/40+"px "+shadowColor+", 0 0 "+shadowAmount/30+"px "+shadowColor+", 0 0 "+shadowAmount/20+"px "+shadowColor+", 0 0 "+shadowAmount/10+"px #ffffff, 0 0 "+shadowAmount/5+"px "+shadowColor+", 0 0 "+shadowAmount/3+"px "+shadowColor+", 0 0 "+shadowAmount/1+"px "+shadowColor+""}}>
            </div>
          </div>
        </div>
      )
    }






    let {address,changeAlert,i18n} = this.props
    let qrSize = Math.min(document.documentElement.clientWidth,512)-90
    let qrValue = address

    let connextBalance = ""
    if(this.state.connextInfo&&this.state.connextInfo.persistent){
      console.log("balanceTokenUser",this.state.connextInfo.persistent.channel.balanceTokenUser)
      let inEthLong = this.props.web3.utils.fromWei(""+this.state.connextInfo.persistent.channel.balanceTokenUser,'ether')

      connextBalance =(
        <div style={{fontSize:26}}>
          {this.props.dollarDisplay(
            inEthLong
          )}
          <img
            src={connextLogo}
            style={{ maxWidth: 22, maxHeight: 22 }}
          />
        </div>
      )

    }

    return (
      <div>

        <div className="form-group w-100">
          <div style={{ width: "100%", textAlign: "center" }}>
            <Ruler />
            <div style={{ padding: 20 }}>
              <div style={{fontSize:26}}>
                {this.props.dollarDisplay(
                  this.props.ethBalance * this.props.ethprice
                )}
                <img
                  src={this.props.eth}
                  style={{ maxWidth: 22, maxHeight: 22 }}
                />
                ({Math.round(this.props.ethBalance*10000)/10000}) [{this.props.dollarDisplay(this.props.ethprice)}]
              </div>

            </div>
          </div>
          <Ruler />
          <div className="content row">
            <div className="input-group">
              <div className="input-group-prepend">
                <div className="input-group-text">$</div>
              </div>
              <input
                type="text"
                className="form-control"
                placeholder="Amount to Depost or Withdraw"
                value={this.state.withdrawOrDepositAmount}
                ref={input => {
                  this.depositInput = input;
                }}
                onChange={event =>
                  this.setState({ withdrawOrDepositAmount: event.target.value })
                }
              />
            </div>

          </div>
          <div className="content bridge row">
            <div className="col-6 p-1">
              <button
                className="btn btn-large w-100"
                style={this.props.buttonStyle.secondary}
                onClick={async () => {
                  this.setState({percent:1,withdrawOrDepositAmount:""})
                  await this.state.connext.deposit({
                    amountWei: this.props.web3.utils.toWei(""+(parseFloat(this.state.withdrawOrDepositAmount)/parseFloat(this.props.ethprice)), "ether"),
                    amountToken: this.props.web3.utils.toWei("0", "ether") // assumed to be in wei units
                  })
                }}
              >
                <Scaler config={{ startZoomAt: 400, origin: "50% 50%" }}>
                  <i className="fas fa-arrow-circle-down" /> {"deposit"}
                </Scaler>
              </button>
            </div>
            <div className="col-6 p-1">
              <button
                className="btn btn-large w-100"
                style={this.props.buttonStyle.secondary}
                onClick={async () => {
                    this.setState({percent:1,withdrawOrDepositAmount:""})
                  //let amount = this.props.web3.utils.toWei("0.1",'ether')
                  /*
              this.props.tx(this.state.YourContract.withdraw(amount),40000,0,0,(result)=>{
                console.log("RESULT@@@@@@@@@@@@@@@@@&&&#&#&#&# ",result)
              })*/
//
                  let withdrawObject = {
                    // address to receive withdrawal funds
                    // does not need to have a channel with connext to receive funds
                    recipient: this.props.address,
                    // USD price if using dai
                    exchangeRate: this.state.connextInfo.runtime.exchangeRate
                      .rates.USD,
                    // wei to transfer from the user's balance to 'recipient'
                    withdrawalWeiUser: this.props.web3.utils.toWei("0", "ether"),
                    // tokens from channel balance to sell back to hub
                    tokensToSell: this.props.web3.utils.toWei(this.state.withdrawOrDepositAmount, "ether")
                  };
                  console.log("WITHDRAWING", withdrawObject);

                  await this.state.connext.withdraw(withdrawObject);
                }}
              >
                <Scaler config={{ startZoomAt: 400, origin: "50% 50%" }}>
                  <i className="fas fa-arrow-circle-up" /> {"withdraw"}
                </Scaler>
              </button>
            </div>
          </div>
          <Ruler />
          <div className="form-group w-100">
            <div style={{ width: "100%", textAlign: "center" }}>
              <div style={{ padding: 20 }}>
                {connextBalance}
              </div>
            </div>
          </div>

          <div className="content row">
            <div className="input-group" style={{marginBottom:10}}>


              <input

                type="text"
                className="form-control"
                placeholder="0x..."
                value={this.state.toAddress}
                ref={input => {
                  this.addressInput = input;
                }}
                onChange={event =>
                  this.setState({ toAddress: event.target.value })
                }
              />

              <div
                className="input-group-append"
                onClick={() => {
                  this.props.openScanner({ view: "yourmodule" });
                }}
              >
                <span
                  className="input-group-text"
                  id="basic-addon2"
                  style={this.props.buttonStyle.primary}
                >
                  <i style={{ color: "#FFFFFF" }} className="fas fa-qrcode" />
                </span>
              </div>
            </div>
          </div>
          <div className="content row">
            <div className="input-group">
            <div className="input-group-prepend">
              <div className="input-group-text">$</div>
            </div>
              <input
                type="text"
                className="form-control"
                placeholder="Amount to Send"
                value={this.state.payAmount}
                ref={input => {
                  this.payInput = input;
                }}
                onChange={event =>
                  this.setState({ payAmount: event.target.value })
                }
              />
            </div>
          </div>
          <button
            className={"btn btn-lg w-100"}
            style={this.props.buttonStyle.primary}
            onClick={async () => {

              this.exchangeIfNeeded()
              let cObject = {
                recipient: this.state.toAddress, // payee  address
                //amount: {
                  amountToken: this.props.web3.utils.toWei(this.state.payAmount,'ether'), //this.props.web3.utils.toWei("1",'ether'),
                //  amountWei: "0" // only token payments are facilitated
                //},
                //type: "PT_OPTIMISTIC" // the payment type, see the client docs for more
              }
              console.log("cObject",cObject)
              console.log(`address: ${this.state.toAddress}`)
              const purchaseId = await this.state.connext.buy({
                payments: [
                  cObject
                ]
              });
              this.setState({payAmount:"",toAddress:""})
            }}
          >
            Send
          </button>
        </div>
        <Ruler />

        <div className="main-card card w-100" style={{paddingTop:40}}>
        <CopyToClipboard text={address} onCopy={() => {
          changeAlert({type: 'success', message: i18n.t('receive.address_copied')})
        }}>
          <div className="content qr row" style={{cursor:"pointer"}}>
          <QRCode value={qrValue} size={qrSize}/>
          <div className="input-group">
            <input type="text" className="form-control" style={{color:"#999999"}} value={address} disabled/>
            <div className="input-group-append">
              <span className="input-group-text"><i style={{color:"#999999"}}  className="fas fa-copy"/></span>
            </div>
          </div>
          </div>
        </CopyToClipboard>
        </div>

      </div>
    );
  }
}
