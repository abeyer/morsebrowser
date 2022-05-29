import Cookies from 'js-cookie'

export class MorseExtenders {
  static init (ko, ctxt) {
    ko.extenders.saveCookie = (target, option) => {
      target.subscribe((newValue) => {
        Cookies.set(option, newValue, { expires: 365 })
      })
      return target
    }

    ko.extenders.showingChange = (target, option) => {
      target.subscribe((newValue) => {
        if (ctxt.showRaw()) {
          ctxt.rawText(newValue)
        }
      })
      return target
    }
    ko.extenders.showRawChange = (target, option) => {
      target.subscribe((newValue) => {
        // console.log(option + ": " + newValue);
        if (newValue) {
          ctxt.showingText(ctxt.rawText())
        } else {
          ctxt.showingText('')
        }
      })
      return target
    }

    ko.extenders.setVolume = (target, option) => {
      target.subscribe((newValue) => {
        ctxt.morseWordPlayer.setVolume(newValue)
      })
      return target
    }

    ko.extenders.setNoiseVolume = (target, option) => {
      target.subscribe((newValue) => {
        ctxt.morseWordPlayer.setNoiseVolume(newValue)
      })
      return target
    }

    ko.extenders.setNoiseType = (target, option) => {
      target.subscribe((newValue) => {
        const config = ctxt.getMorseStringToWavBufferConfig('')
        config.noise.type = ctxt.noiseEnabled() ? newValue : 'off'
        ctxt.morseWordPlayer.setNoiseType(config)
      })
      return target
    }

    ko.extenders.initRss = (target, option) => {
      target.subscribe((newValue) => {
        if (newValue) {
          ctxt.initializeRss()
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
  }

  static apply (ctxt) {
    ctxt.settings.speed.wpm.extend({ saveCookie: 'wpm' })
    ctxt.settings.speed.fwpm.extend({ saveCookie: 'fwpm' })
    ctxt.ditFrequency.extend({ saveCookie: 'ditFrequency' })
    ctxt.dahFrequency.extend({ saveCookie: 'dahFrequency' })
    ctxt.hideList.extend({ saveCookie: 'hideList' })
    ctxt.showingText.extend({ showingChange: 'showingChange' })
    ctxt.showRaw.extend({ showRawChange: 'showRawChange' })
    ctxt.preSpace.extend({ saveCookie: 'preSpace' })
    ctxt.xtraWordSpaceDits.extend({ saveCookie: 'xtraWordSpaceDits' })
    ctxt.volume.extend({ saveCookie: 'volume' }).extend({ setVolume: 'volume' })
    ctxt.noiseVolume.extend({ saveCookie: 'noiseVolume' }).extend({ setNoiseVolume: 'noiseVolume' })
    ctxt.noiseType.extend({ saveCookie: 'noiseType' }).extend({ setNoiseType: 'noiseType' })
    ctxt.settings.speed.syncWpm.extend({ saveCookie: 'syncWpm' })
    ctxt.syncFreq.extend({ saveCookie: 'syncFreq' })
    ctxt.rssEnabled.extend({ initRss: 'rssEnabled' })
    ctxt.showExpertSettings.extend({ saveCookie: 'showExpertSettings' })
    ctxt.cardFontPx.extend({ saveCookie: 'cardFontPx' })
  }
}