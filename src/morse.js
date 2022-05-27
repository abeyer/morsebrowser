import ko from 'knockout'

// see https://getbootstrap.com/docs/5.0/getting-started/webpack/
import 'bootstrap/dist/css/bootstrap.min.css'
// You can specify which plugins you need
// Note that even though these don't seem to be used directly,
// they are used by the accordian.
// eslint-disable-next-line no-unused-vars
import { Tooltip, Toast, Popover } from 'bootstrap'

import MorseStringUtils from './morseStringUtils.js'
import { MorseStringToWavBufferConfig } from './morseStringToWavBuffer.js'
import { MorseWordPlayer } from './morseWordPlayer.js'

// NOTE: moved this to dynamic import() so that non-RSS users don't need to bother
// even loading this code into the browser:
// import RSSParser from 'rss-parser';

import Cookies from 'js-cookie'
import MorseLessonPlugin from './morseLessonPlugin.js'
import { MorseLoadImages } from './morseLoadImages.js'

class MorseViewModel {
  constructor () {
    this.morseLoadImages(new MorseLoadImages())

    // create the helper extenders
    ko.extenders.saveCookie = (target, option) => {
      target.subscribe((newValue) => {
        Cookies.set(option, newValue, { expires: 365 })
      })
      return target
    }

    ko.extenders.showingChange = (target, option) => {
      target.subscribe((newValue) => {
        if (this.showRaw()) {
          this.rawText(newValue)
        }
      })
      return target
    }
    ko.extenders.showRawChange = (target, option) => {
      target.subscribe((newValue) => {
        // console.log(option + ": " + newValue);
        if (newValue) {
          this.showingText(this.rawText())
        } else {
          this.showingText('')
        }
      })
      return target
    }

    ko.extenders.setVolume = (target, option) => {
      target.subscribe((newValue) => {
        this.morseWordPlayer.setVolume(newValue)
      })
      return target
    }

    ko.extenders.setNoiseVolume = (target, option) => {
      target.subscribe((newValue) => {
        this.morseWordPlayer.setNoiseVolume(newValue)
      })
      return target
    }

    ko.extenders.setNoiseType = (target, option) => {
      target.subscribe((newValue) => {
        const config = this.getMorseStringToWavBufferConfig('')
        config.noise.type = this.noiseEnabled() ? newValue : 'off'
        this.morseWordPlayer.setNoiseType(config)
      })
      return target
    }

    ko.extenders.initRss = (target, option) => {
      target.subscribe((newValue) => {
        if (newValue) {
          this.initializeRss()
        }
      })
      return target
    }

    ko.extenders.dummyLogger = (target, option) => {
      target.subscribe((newValue) => {
        console.log(`dummyloggerextension option:${option} newValue:${newValue}`)
      })
      return target
    }

    // apply extenders
    this.wpm.extend({ saveCookie: 'wpm' })
    this.fwpm.extend({ saveCookie: 'fwpm' })
    this.ditFrequency.extend({ saveCookie: 'ditFrequency' })
    this.dahFrequency.extend({ saveCookie: 'dahFrequency' })
    this.hideList.extend({ saveCookie: 'hideList' })
    this.showingText.extend({ showingChange: 'showingChange' })
    this.showRaw.extend({ showRawChange: 'showRawChange' })
    this.preSpace.extend({ saveCookie: 'preSpace' })
    this.xtraWordSpaceDits.extend({ saveCookie: 'xtraWordSpaceDits' })
    this.volume.extend({ saveCookie: 'volume' }).extend({ setVolume: 'volume' })
    this.noiseVolume.extend({ saveCookie: 'noiseVolume' }).extend({ setNoiseVolume: 'noiseVolume' })
    this.noiseType.extend({ saveCookie: 'noiseType' }).extend({ setNoiseType: 'noiseType' })
    this.syncWpm.extend({ saveCookie: 'syncWpm' })
    this.syncFreq.extend({ saveCookie: 'syncFreq' })
    this.rssEnabled.extend({ initRss: 'rssEnabled' })
    this.showExpertSettings.extend({ saveCookie: 'showExpertSettings' })
    // initialize the main rawText
    this.rawText(this.showingText())

    MorseLessonPlugin.addLessonFeatures(ko, this)

    // check for RSS feature turned on
    if (this.getParameterByName('rssEnabled')) {
      this.rssEnabled(true)
      this.initializeRss()
    }

    // check for noise feature turned on
    if (this.getParameterByName('noiseEnabled')) {
      this.noiseEnabled(true)
    }

    this.loadCookies()

    // initialize the wordlist
    this.initializeWordList()
  }

   textBuffer = ko.observable('')
   trueWpm = ko.observable(20)
   trueFwpm = ko.observable(20)
   syncWpm = ko.observable(true)

   wpm = ko.pureComputed({
     read: () => {
       return this.trueWpm()
     },
     write: (value) => {
       this.trueWpm(value)
       if (this.syncWpm() || parseInt(value) < parseInt(this.trueFwpm())) {
         this.trueFwpm(value)
       }
     },
     owner: this
   })

   fwpm = ko.pureComputed({
     read: () => {
       if (!this.syncWpm()) {
         if (parseInt(this.trueFwpm()) <= parseInt(this.trueWpm())) {
           return this.trueFwpm()
         } else {
           return this.trueWpm()
         }
       } else {
         this.trueFwpm(this.trueWpm())
         return this.trueFwpm()
       }
     },
     write: (value) => {
       if (parseInt(value) <= parseInt(this.trueWpm())) {
         this.trueFwpm(value)
       }
     },
     owner: this
   })

   trudDitFrequency = ko.observable(550)
   truDahFrequency = ko.observable(550)
   syncFreq = ko.observable(true)
   ditFrequency = ko.pureComputed({
     read: () => {
       return this.trudDitFrequency()
     },
     write: (value) => {
       this.trudDitFrequency(value)
       if (this.syncFreq()) {
         this.truDahFrequency(value)
       }
     },
     owner: this
   })

   dahFrequency = ko.pureComputed({
     read: () => {
       if (!this.syncFreq()) {
         return this.truDahFrequency()
       } else {
         this.truDahFrequency(this.trudDitFrequency())
         return this.trudDitFrequency()
       }
     },
     write: (value) => {
       this.truDahFrequency(value)
     },
     owner: this
   })

   hideList = ko.observable(true)
   currentSentanceIndex = ko.observable(0)
   currentIndex = ko.observable(0)
   playerPlaying = ko.observable(false)
   lastFullPlayTime = ko.observable(new Date(1900, 0, 0))
   preSpace = ko.observable(0)
   preSpaceUsed = ko.observable(false)
   xtraWordSpaceDits = ko.observable(0)
   flaggedWords = ko.observable('')
   isShuffled = ko.observable(false)
   trailReveal = ko.observable(false)
   preShuffled = ''
   wordLists = ko.observableArray()
   morseWordPlayer = new MorseWordPlayer()
   rawText = ko.observable()
   showingText = ko.observable('CQ LICW')
   showRaw = ko.observable(true)
   rssEnabled = ko.observable(false)
   rssInitializedOnce = ko.observable(false)
   volume = ko.observable(10)
   noiseEnabled = ko.observable(false)
   noiseVolume = ko.observable(2)
   noiseType = ko.observable('off')
   userTarget = ko.observable('')
   selectedClass = ko.observable('')
   userTargetInitialized = false
   selectedClassInitialized = false
   letterGroupInitialized = false
   displaysInitialized = false
   letterGroup = ko.observable('')
   selectedDisplay = ko.observable({})
   lastPlayFullStart = null;
   randomizeLessons = ko.observable(true)
   ifOverrideTime = ko.observable(false)
   overrideMins = ko.observable(2)
   customGroup = ko.observable('')
   ifOverrideMinMax = ko.observable(false)
   trueOverrideMin = ko.observable(3)
   overrideMin = ko.pureComputed({
     read: () => {
       return this.trueOverrideMin()
     },
     write: (value) => {
       this.trueOverrideMin(value)
       if (this.syncSize()) {
         this.trueOverrideMax(value)
       }
     },
     owner: this
   })

   trueOverrideMax = ko.observable(3)
   overrideMax = ko.pureComputed({
     read: () => {
       if (!this.syncSize()) {
         return this.trueOverrideMax()
       } else {
         this.trueOverrideMax(this.trueOverrideMin())
         return this.trueOverrideMin()
       }
     },
     write: (value) => {
       if (value >= this.trueOverrideMin()) {
         this.trueOverrideMax(value)
       }
     },
     owner: this
   })

   ifParseSentences = ko.observable(false)
   ifStickySets = ko.observable(true)
   stickySets = ko.observable('BK')
   runningPlayMs = ko.observable(0)
   lastPartialPlayStart = ko.observable()
   isPaused=ko.observable(false)
   syncSize=ko.observable(true)
   morseLoadImages =ko.observable()
   showExpertSettings = ko.observable(false)

   // helper
   loadCookies = (whiteList) => {
     // load any existing cookie values

     // helper
     const booleanize = (x) => {
       if (x === 'true ' || x === 'false') {
         return x === 'true'
       } else {
         return x
       }
     }

     const cks = Cookies.get()
     if (cks) {
       const specialHandling = []
       for (const key in cks) {
         if (!whiteList || whiteList.indexOf(key) > -1) {
           switch (key) {
             case 'syncWpm':
             case 'wpm':
             case 'fwpm':
             case 'syncFreq':
             case 'ditFrequency':
             case 'dahFrequency':
               specialHandling.push({ key, val: booleanize(cks[key]) })
               break
             default:
               if (typeof this[key] !== 'undefined') {
                 this[key](booleanize(cks[key]))
               }
           }
         }
       }
       let target = specialHandling.find(x => x.key === 'syncWpm')
       if (target) {
         this[target.key](target.val)
       }
       target = specialHandling.find(x => x.key === 'syncFreq')
       if (target) {
         this[target.key](target.val)
       }
       specialHandling.forEach((x) => {
         this[x.key](x.val)
       })
     }
   }

   // helper
   // https://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript
   getParameterByName = (name, url = window.location.href) => {
     // eslint-disable-next-line no-useless-escape
     name = name.replace(/[\[\]]/g, '\\$&')
     const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)')
     const results = regex.exec(url)
     if (!results) return null
     if (!results[2]) return ''
     return decodeURIComponent(results[2].replace(/\+/g, ' '))
   }

   changeSentance = () => {
     this.currentIndex(0)
   }

   setText = (s) => {
     if (this.showRaw()) {
       this.showingText(s)
     } else {
       this.rawText(s)
     }
   }

   sentences = ko.computed(() => {
     if (!this.rawText()) {
       return []
     }

     return MorseStringUtils.getSentences(this.rawText(), !this.ifParseSentences())
   }, this)

   sentenceMax = ko.computed(() => {
     return this.sentences().length - 1
   }, this)

   words = ko.computed(() => {
     return this.sentences()[this.currentSentanceIndex()]
   }, this)

   flaggedWordsCount = ko.computed(() => {
     if (!this.flaggedWords().trim()) {
       return 0
     }
     return this.flaggedWords().trim().split(' ').length
   }, this)

   shuffleWords = () => {
     if (!this.isShuffled()) {
       this.preShuffled = this.rawText()
       this.setText(this.rawText().split(' ').sort(() => { return 0.5 - Math.random() }).join(' '))
     } else {
       this.setText(this.preShuffled)
     }
     this.isShuffled(!this.isShuffled())
   }

   incrementIndex = () => {
     if (this.currentIndex() < this.words().length - 1) {
       this.currentIndex(this.currentIndex() + 1)
     } else {
       // move to next sentence
       if (this.currentSentanceIndex() < this.sentenceMax()) {
         this.currentSentanceIndex(Number(this.currentSentanceIndex()) + 1)
         this.currentIndex(0)
       }
     }
   }

  decrementIndex = () => {
    this.morseWordPlayer.pause(() => {
      if (this.currentIndex() > 0 && this.words().length > 1) {
        this.currentIndex(this.currentIndex() - 1)
        // experience shows it is good to put a little pause here
        // so they dont' blur together
        setTimeout(this.doPlay, 1000)
      }
    })
  }

  fullRewind = () => {
    // if (this.sentenceMax()>0) {
    this.currentSentanceIndex(0)
    this.currentIndex(0)
    // }
  }

  sentanceRewind = () => {
    // if (this.sentenceMax()>0) {
    // self.currentSentanceIndex(0);
    this.currentIndex(0)
    // }
  }

  setWordIndex = (index) => {
    if (!this.playerPlaying()) {
      this.currentIndex(index)
    } else {
      this.doPause(false, false)
      this.currentIndex(index)
      this.doPlay(false, false)
    }
  }

  addFlaggedWord = (word) => {
    if (!this.flaggedWords().trim()) {
      this.flaggedWords(this.flaggedWords().trim() + word)
    } else {
      // deal with double click which is also used to pick a word
      const words = this.flaggedWords().trim().split(' ')
      const lastWord = words[words.length - 1]
      if (lastWord === word) {
        // we have either a double click scenario, or otherwise user
        // selected word twice so either way assume removal
        words.pop()
      } else {
        words.push(word)
      }
      if (words.length === 0) {
        this.flaggedWords('')
      } else {
        this.flaggedWords(words.join(' '))
      }
    }
  }

  setFlagged = () => {
    if (this.flaggedWords().trim()) {
      this.doPause(true, false)
      this.setText(this.flaggedWords())
      this.fullRewind()
      document.getElementById('btnFlaggedWordsAccordianButton').click()
    }
  }

  doCustomGroup = () => {
    if (this.customGroup()) {
      const data = { letters: this.customGroup().trim().replace(/ /g, '') }
      this.randomWordList(data, true)
      this.closeLessonAccordianIfAutoClosing()
    }
  }

  randomWordList = (data, ifCustom) => {
    let str = ''
    const splitWithProsignsAndStcikys = (s) => {
      let stickys = ''
      if (this.ifStickySets() && this.stickySets().trim()) {
        stickys = '|' + this.stickySets().toUpperCase().trim().replace(/ {2}/g, ' ').replace(/ /g, '|')
      }

      const regStr = `<.*?>${stickys}|[^<.*?>]|\\W`
      // console.log(regStr)
      const re = new RegExp(regStr, 'g')
      const match = s.toUpperCase().match(re)
      // console.log(match)
      return match
    }
    const chars = splitWithProsignsAndStcikys(data.letters)
    let seconds = 0
    const controlTime = (this.ifOverrideTime() || ifCustom) ? (this.overrideMins() * 60) : data.practiceSeconds
    const minWordSize = (this.ifOverrideMinMax() || ifCustom) ? this.overrideMin() : data.minWordSize
    const maxWordSize = (this.ifOverrideMinMax() || ifCustom) ? this.overrideMax() : data.maxWordSize
    // Fn to generate random number min/max inclusive
    // https://www.geeksforgeeks.org/how-to-generate-random-number-in-given-range-using-javascript/
    const randomNumber = (min, max) => {
      min = Math.ceil(min)
      max = Math.floor(max)
      return Math.floor(Math.random() * (max - min + 1)) + min
    }

    do {
      let word = ''

      if (this.randomizeLessons()) {
        // determine word length
        const wordLength = minWordSize === maxWordSize ? minWordSize : randomNumber(minWordSize, maxWordSize)

        for (let j = 1; j <= wordLength; j++) { // for each letter
          // determine the letter
          word += chars[randomNumber(1, chars.length) - 1]
        }
      } else {
        word = data.letters
      }

      str += seconds > 0 ? (' ' + word.toUpperCase()) : word.toUpperCase()

      const config = this.getMorseStringToWavBufferConfig(str)
      const est = this.morseWordPlayer.getTimeEstimate(config)
      seconds = est.timeCalcs.totalTime / 1000
    } while (seconds < controlTime)

    this.setText(str)
  }

  getMorseStringToWavBufferConfig = (text) => {
    const config = new MorseStringToWavBufferConfig()
    config.word = MorseStringUtils.doReplacements(text)
    config.wpm = parseInt(this.wpm())
    config.fwpm = parseInt(this.fwpm())
    config.ditFrequency = parseInt(this.ditFrequency())
    config.dahFrequency = parseInt(this.dahFrequency())
    config.prePaddingMs = this.preSpaceUsed() ? 0 : this.preSpace() * 1000
    config.xtraWordSpaceDits = parseInt(this.xtraWordSpaceDits())
    config.volume = parseInt(this.volume())
    config.noise = {
      type: this.noiseEnabled() ? this.noiseType() : 'off',
      volume: parseInt(this.noiseVolume())
    }
    config.playerPlaying = this.playerPlaying()
    return config
  }

  doPlay = (playJustEnded, fromPlayButton) => {
    if (!this.rawText().trim()) {
      return
    }
    // we get here several ways:
    // 1. user presses play for the first time
    // 1a. set prespaceused to false, so it will get used.
    // 1b. set the elapsed ms to 0
    // 2. user presses play after a pause
    // 2a. set prespaceused to false, so it will get used again.
    // 3. we just finished playing a word
    // 4. user might press play to re-play a word
    const wasPlayerPlaying = this.playerPlaying()
    const freshStart = fromPlayButton && !wasPlayerPlaying
    if (!this.lastPlayFullStart || (this.lastFullPlayTime() > this.lastPlayFullStart)) {
      this.lastPlayFullStart = Date.now()
    }
    this.isPaused(false)
    this.playerPlaying(true)
    if (!playJustEnded) {
      this.preSpaceUsed(false)
    }

    if (freshStart) {
      this.runningPlayMs(0)
    }
    // experience shows it is good to put a little pause here when user forces us here,
    // e.g. hitting back or play b/c word was misunderstood,
    // so they dont' blur together.
    if (this.doPlayTimeOut) {
      clearTimeout(this.doPlayTimeOut)
    }
    this.doPlayTimeOut = setTimeout(() => this.morseWordPlayer.pause(() => {
      const config = this.getMorseStringToWavBufferConfig(this.words()[this.currentIndex()])
      this.morseWordPlayer.play(config, this.playEnded)
      this.lastPartialPlayStart(Date.now())
      this.preSpaceUsed(true)
    }),
    playJustEnded || fromPlayButton ? 0 : 1000)
  }

  playEnded = () => {
    this.runningPlayMs(this.runningPlayMs() + (Date.now() - this.lastPartialPlayStart()))
    if (this.currentIndex() < this.words().length - 1) {
      this.incrementIndex()
      this.doPlay(true)
    } else if (this.currentSentanceIndex() < this.sentenceMax()) {
      // move to next sentence
      this.currentSentanceIndex(Number(this.currentSentanceIndex()) + 1)
      this.currentIndex(0)
      this.doPlay(true)
    } else {
      // nothing more to play
      this.doPause(true)
    }
  }

  doPause = (fullRewind, fromPauseButton) => {
    if (fromPauseButton) {
      this.runningPlayMs(this.runningPlayMs() + (Date.now() - this.lastPartialPlayStart()))
      this.isPaused(!this.isPaused())
    } else {
      this.isPaused(false)
    }
    this.playerPlaying(false)
    this.morseWordPlayer.pause(() => {
      // we're here if a complete rawtext finished
      // console.log('settinglastfullplaytime')
      this.lastFullPlayTime(Date.now())
      // console.log(`playtime:${this.lastFullPlayTime() - this.lastPlayFullStart}`)
      // TODO make this more generic for any future "plugins"
      if (this.rssPlayCallback) {
        this.rssPlayCallback()
      }

      this.preSpaceUsed(false)
    }, true)
    if (fullRewind) {
      this.fullRewind()
    }
  }

  inputFileChange = (file) => {
    // thanks to https://newbedev.com/how-to-access-file-input-with-knockout-binding
    // console.log(file)
    const fr = new FileReader()
    fr.onload = (data) => {
      this.setText(data.target.result)
    }
    fr.readAsText(file)
  }

  doDownload = () => {
    let allWords = ''
    const sentences = this.sentences()
    sentences.forEach((sentence) => {
      sentence.forEach((word) => {
        allWords += allWords.length > 0 ? ' ' + word : word
      })
    })
    const config = this.getMorseStringToWavBufferConfig(allWords)
    const wav = this.morseWordPlayer.getWavAndSample(config)
    const ary = new Uint8Array(wav.wav)
    const link = document.getElementById('downloadLink')
    const blob = new Blob([ary], { type: 'audio/wav' })
    link.href = URL.createObjectURL(blob)
    link.download = 'morse.wav'
    link.dispatchEvent(new MouseEvent('click'))
  }

  dummy = () => {
    console.log('dummy')
  }

  timeEstimate = ko.computed(() => {
    // this computed doesn't seem bound to anything but .rawText, but for some reason it is
    // still recomputing on wpm/fwpm/xtra changes, so...ok
    if (!this.rawText()) {
      return { minutes: 0, seconds: 0, normedSeconds: '00' }
    }
    const config = this.getMorseStringToWavBufferConfig(this.rawText())
    const est = this.morseWordPlayer.getTimeEstimate(config)
    const minutes = Math.floor(est.timeCalcs.totalTime / 60000)
    const seconds = ((est.timeCalcs.totalTime % 60000) / 1000).toFixed(0)
    const normedSeconds = (seconds < 10 ? '0' : '') + seconds
    const timeFigures = { minutes, seconds, normedSeconds }
    // console.log(timeFigures)
    // console.log(est)
    return timeFigures
  }, this)

  playingTime = ko.computed(() => {
    const minutes = Math.floor(this.runningPlayMs() / 60000)
    const seconds = ((this.runningPlayMs() % 60000) / 1000).toFixed(0)
    const normedSeconds = (seconds < 10 ? '0' : '') + seconds
    const timeFigures = { minutes, seconds, normedSeconds }
    // console.log(timeFigures)
    // console.log(est)
    return timeFigures
  }, this)

  initializeRss = (afterCallBack) => {
    if (!this.rssInitializedOnce()) {
      import('./morseRssPlugin.js').then(({ default: MorseRssPlugin }) => {
        MorseRssPlugin.addRssFeatures(ko, this)
        // don't set this until the plugin has initialized above
        this.rssInitializedOnce(true)
        // possibly rss-related cookies missed
        // TODO probably in general 'plugins' should be some sort of promise based
        // and load cookies after all plugins but for now just do this....
        this.loadCookies(this.rssCookieWhiteList)
        if (afterCallBack) {
          afterCallBack()
        }
      })
    }
  }

  doClear = () => {
    // stop playing
    this.doPause(true, false)
    this.setText('')
  }
}

// eslint-disable-next-line new-cap
ko.applyBindings(new MorseViewModel())