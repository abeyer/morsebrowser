
import MorseCWWave from './morse-pro/morse-pro-cw-wave.js';
import * as RiffWave from './morse-pro/morse-pro-util-riffwave.js';
import ko from 'knockout';

//see https://getbootstrap.com/docs/5.0/getting-started/webpack/
import 'bootstrap/dist/css/bootstrap.min.css';
// You can specify which plugins you need
import { Tooltip, Toast, Popover } from 'bootstrap';



var myAudioContext; 
var source;
var sourceEnded;
var sourceEndedCallBack;

function doPlay(word, wpm, fwpm, frequency, onEnded) {
    sourceEnded=false;
    sourceEndedCallBack=onEnded;
    let useProsigns=true;
    let sampleRate=8000;
    let unit = 1200 / fwpm;
    console.log(unit);
    let wordSpace = unit * 7;
    let morseCWWave = new MorseCWWave(useProsigns, wpm, fwpm, frequency, sampleRate);
    morseCWWave.translate(word,false);
    var wav = RiffWave.getData(morseCWWave.getSample(wordSpace)); 
    
    if (typeof(myAudioContext)=="undefined") {
        myAudioContext = new AudioContext();
    }
    
    source = myAudioContext.createBufferSource();
    source.addEventListener('ended', ()=>{
        sourceEnded=true;
        sourceEndedCallBack();
    });
    let mybuf = new Int8Array(wav).buffer;
    var mybuf2;
    myAudioContext.decodeAudioData(mybuf, (x) =>{
        // thanks https://middleearmedia.com/web-audio-api-audio-buffer/
        mybuf2=x;
        console.log(mybuf2);
        source.buffer = mybuf2;
        source.connect(myAudioContext.destination);
        source.start(0);
    } , (e)=>{
        console.log("error");
        console.log(e);
    });
        
}

function doPause(pauseCallBack) {
    
    if (typeof(myAudioContext)=="undefined") {
        pauseCallBack()
    } else {
        console.log(myAudioContext.state);
        if (typeof(source)!="undefined") {
            if (!sourceEnded) {
                sourceEndedCallBack = pauseCallBack;
                source.stop();
            } else {
                pauseCallBack();
            }

            
            //myAudioContext.close().then(pauseCallBack());
        } else {
            pauseCallBack();
        }
    }
}


function vwModel()  {
    var self = this;
    self.rawText= ko.observable("hello world");
    self.wpm=ko.observable(20);
    self.fwpm=ko.observable(20);
    self.frequency=ko.observable(550);
    self.hideList=ko.observable(true);
    self.showRaw=ko.observable(true);
    self.currentSentanceIndex = ko.observable(0);
    self.sentences= ko.computed(function() { 

        var splitSents = self.rawText()
            // replacing exclamation with period 
            .replace(/!/g,".")
            // a few ad-hoc attempts to remove rare or non-morse characters
            .replace(/'/g,"")
            .replace(/’/g,"")
            .replace(/‘/g,"")
            // colon becomes a comma
            .replace(/:/g,",")
            // anything else except period, question mark or percent or stroke becomes a space
            .replace(/(?![%,\/\.\?])\W/g," ")
            // turn percent sign into pct abbreviation
            .replace(/%/g,"pct")
            // split on period or question mark
            .split(/([\.\?])/);


        /* example 
        "hello there. how are you? I am fine".split(/([\.\?])/)
        (5) ['hello there', '.', ' how are you', '?', ' I am fine'] 
        */    
        //now put the punctuation back on the end of sentences
        var splitsGlued = splitSents.map((val,i,ary)=>{
            if (i==0 || i%2==0) {
                return val + (((i+1) < ary.length) ? ary[i+1] : "");
            } else {
                return "";
            }
        }).filter(y=>y!="");

        var sents = splitsGlued
        .map((sentence)=>{
            return sentence
            .trim()
            // remove double spaces
            .replace(/  /g," ")
            // split up into words
            .split(" ")
            // get rid fo stray empties
            .filter(x=>x.trim().length>0);
        })
        .filter(x=>x.length>1 || x[0]!=".");
                
        return sents;

        
    }, self);
    self.sentenceMax = ko.computed(function() {
        return self.sentences().length - 1;
    })
    self.words= ko.computed(function() { 
        
        
        return self.sentences()[self.currentSentanceIndex()];

        
    }, self);
    self.currentIndex = ko.observable(0);
    self.changeSentance = function() {
        self.currentIndex(0);
    }
    self.incrementIndex = function() {
        if (self.currentIndex()<self.words().length-1) {
            self.currentIndex(self.currentIndex()+1);
            console.log(self.currentIndex());
        }
        else 
        {
            //move to next sentence
            if (self.currentSentanceIndex() < self.sentenceMax() ) {
                self.currentSentanceIndex(Number(self.currentSentanceIndex())+1);
                self.currentIndex(0);
            }
        }
    }
    self.decrementIndex = function() {
        doPause(()=>{
            if (self.currentIndex()>0 && self.words().length>1) {
                self.currentIndex(self.currentIndex()-1);
                console.log(self.currentIndex());
                //experience shows it is good to put a little pause here
                //so they dont' blur together
                setTimeout(self.doPlay,1000);
             }
        });
        
    }
    self.doPlay = function(playJustEnded) {
        //experience shows it is good to put a little pause here when user forces us here,
        //e.g. hitting back or play b/c word was misunderstood,
        //so they dont' blur together.
        if (self.doPlayTimeOut) {
            clearTimeout(self.doPlayTimeOut);
        }
        self.doPlayTimeOut = setTimeout(()=>
        doPause(()=>{
            doPlay(self.words()[self.currentIndex()],self.wpm(),self.fwpm(),self.frequency(), self.playEnded)
            console.log('played');
        })
        ,playJustEnded ? 0: 1000);
    };
        
    
    self.playEnded = function () {
        console.log('ended');
        if (self.currentIndex()<self.words().length-1) {
            self.incrementIndex();
            self.doPlay(true);
        } else {
            //move to next sentence
            if (self.currentSentanceIndex() < self.sentenceMax() ) {
                self.currentSentanceIndex(Number(self.currentSentanceIndex())+1);
                self.currentIndex(0);
                self.doPlay(true);
            }
        }
    }
    self.doPause = function() {
        doPause(()=>{});
    }

    self.inputFileChange = function(file) {

        //thanks to https://newbedev.com/how-to-access-file-input-with-knockout-binding
        //console.log("input file changed");
        //console.log(e);
        var fr=new FileReader();
        fr.onload=function(data){
            self.rawText(data.target.result);
        }
        fr.readAsText(file);
    }
}

ko.applyBindings(new vwModel());


