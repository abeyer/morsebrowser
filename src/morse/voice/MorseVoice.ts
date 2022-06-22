import * as ko from 'knockout'
import { MorseVoiceInfo } from './MorseVoiceInfo'
import EasySpeech from 'easy-speech'
import { MorseViewModel } from '../morse'
export class MorseVoice {
  voices = []
  voicesInited:boolean = false
  voiceEnabled:ko.Observable<boolean>
  voiceCapable:ko.Observable<boolean>
  voiceThinkingTime:ko.Observable<number>
  voiceVoice:ko.Observable<any>
  voiceVolume:ko.Observable<number>
  voiceRate:ko.Observable<number>
  voicePitch:ko.Observable<number>
  voiceLang:ko.Observable<string>
  voiceVoices:ko.ObservableArray<any>
  voiceBuffer:Array<any>
  ctxt:MorseViewModel
  // keep a reference because read that garbage collector can grab
  // and onend never fires?!
  currentUtterance:SpeechSynthesisUtterance

  constructor (context:MorseViewModel) {
    this.ctxt = context
    this.voiceEnabled = ko.observable(false)
    this.voiceCapable = ko.observable(false)
    this.voiceThinkingTime = ko.observable(0)
    this.voiceVoice = ko.observable()
    this.voiceVolume = ko.observable(10)
    this.voiceRate = ko.observable(1)
    this.voicePitch = ko.observable(1)
    this.voiceLang = ko.observable('en-us')
    this.voiceVoices = ko.observableArray([])
    this.voiceBuffer = []
    const speechDetection = EasySpeech.detect()

    if (speechDetection.speechSynthesis && speechDetection.speechSynthesisUtterance) {
      this.logToFlaggedWords('Speech Available')
      this.voiceCapable(true)
    } else {
      this.logToFlaggedWords(`Synthesis: ${speechDetection.speechSynthesis} Utterance:${speechDetection.speechSynthesisUtterance}`)
    }

    this.initEasySpeech()
  }

  initEasySpeech = async () => {
    // let easySpeechInitStatus

    EasySpeech.init().then((e) => {
      this.logToFlaggedWords(`easyspeechinit: ${e}`)
      this.populateVoiceList()
    }).catch((e) => {
      this.logToFlaggedWords(`error in easyspeechinit: ${e}`)
    })
  }

  logToFlaggedWords = (s) => {
    this.ctxt.logToFlaggedWords(s)
  }

  populateVoiceList = () => {
    if (!this.voiceCapable()) {
      return
    }

    const easySpeechStatus = EasySpeech.status()
    if (easySpeechStatus.voices && easySpeechStatus.voices.length) {
      this.voices = easySpeechStatus.voices
      this.voices.forEach(v => {
        this.logToFlaggedWords(`voiceAvailable:${v.name}  ${v.lang}`)
      })
      this.voices = this.voices.filter(x => x.lang === 'en-US')
      this.voiceVoices(this.voices)
      this.logToFlaggedWords(`loaded voices:${this.voices.length}`)
    } else {
      this.logToFlaggedWords('no voices')
    }
  }

  speakInfo = (morseVoiceInfo:MorseVoiceInfo) => {
    try {
      const esConfig = {
        text: morseVoiceInfo.textToSpeak,
        pitch: morseVoiceInfo.pitch,
        rate: morseVoiceInfo.rate,
        end: e => {
          this.logToFlaggedWords('end event')
          morseVoiceInfo.onEnd()
          this.logToFlaggedWords('onEnd called')
        },
        volume: morseVoiceInfo.volume,
        voice: morseVoiceInfo.voice ?? null,
        error: e => {
          this.logToFlaggedWords(`error event during speak:${e}`)
          morseVoiceInfo.onEnd()
        },
        boundary: e => this.logToFlaggedWords('boundary event'),
        mark: e => this.logToFlaggedWords('mark event'),
        pause: e => this.logToFlaggedWords('pause event'),
        force: true
      }

      EasySpeech.speak(esConfig)
    } catch (e) {
      this.logToFlaggedWords(`caught in speakInfo2:${e}`)
      morseVoiceInfo.onEnd()
    }
  }

  speakPhrase = (phraseToSpeak:string, onEndCallBack) => {
    try {
      const morseVoiceInfo = new MorseVoiceInfo()
      morseVoiceInfo.textToSpeak = phraseToSpeak
      if (this.voiceVoice()) {
        this.logToFlaggedWords(`user selected a voice ${this.voiceVoice().name} ${this.voiceVoice().lang}`)
        morseVoiceInfo.voice = this.voiceVoice()
      } else {
        this.logToFlaggedWords('user did not select a voice')
        if (this.voices.length > 0) {
          this.logToFlaggedWords(`selecting default 0 voice ${this.voices[0].name} ${this.voices[0].lang}`)
          morseVoiceInfo.voice = this.voices[0]
        } else {
          this.logToFlaggedWords('no voices')
          morseVoiceInfo.voice = null
        }
      }

      morseVoiceInfo.volume = this.voiceVolume() / 10
      morseVoiceInfo.rate = this.voiceRate()
      morseVoiceInfo.pitch = this.voicePitch()
      morseVoiceInfo.onEnd = onEndCallBack
      this.speakInfo(morseVoiceInfo)
    } catch (e) {
      this.logToFlaggedWords(`caught in speakPhrase:${e}`)
      onEndCallBack()
    }
  }
}