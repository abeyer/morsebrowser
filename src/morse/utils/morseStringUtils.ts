import wordifiers from '../../configs/wordify.json'
export default class MorseStringUtils {
  static doReplacements = (s:string):string => {
    const afterReplaced = s
    // a few ad-hoc attempts to fix unicode or other problems
    // weird slashed 0 Ø
      .replace(/Ø/g, '0')
    // seems like apostraphe is not morse-able
      .replace(/’/g, '')
      .replace(/‘/g, '')
      .replace(/'/g, '')
    // turn percent sign into pct abbreviation
      .replace(/%/g, 'pct')
    // in the square brackets we add all symbols supported by morse-pro (see more-pro.js), otherwise replace with space
    // note we will preserve \r and \n for voice which uses these are phrase delimiters
    // eslint-disable-next-line no-useless-escape
      .replace(/(?![\.\,\:\?\\\-\/\(\)\"\@\=\&\+\!\<\>\r\n])\W/g, ' ')
    return afterReplaced
  }

  static splitIntoSentences = (replaced:string):string[] => {
    // split on period or question mark or exclamation mark
    // eslint-disable-next-line no-useless-escape
    const splitSents = replaced.split(/([\.\?\!])/)
    // example
    //  "hello there. how are you? I am fine".split(/([\.\?])/)
    // eslint-disable-next-line no-irregular-whitespace
    // eslint-disable-next-line no-irregular-whitespace
    // (5) ['hello there', '.', ' how are you', '?', ' I am fine']
    // now put the punctuation back on the end of sentences
    const splitsGlued = splitSents.map((val, i, ary) => {
      if (i === 0 || i % 2 === 0) {
        return val + (((i + 1) < ary.length) ? ary[i + 1] : '')
      } else {
        return ''
      }
    }).filter(y => y !== '')
    return splitsGlued
  }

  static getSentences = (s:string, dontSplit:boolean, newlineChunking:boolean):string[][] => {
    const replaced:string = this.doReplacements(s)
    const splitsGlued:string[] = dontSplit ? [replaced] : this.splitIntoSentences(replaced)
    const sents:string[][] = splitsGlued
      .map((sentence) => {
        const hasNewLine = newlineChunking // sentence.indexOf('\n') !== -1
        return sentence
          .trim()
        // remove double spaces
        // eslint-disable-next-line no-regex-spaces
          .replace(/  /g, ' ')
        // add spaces after newlines
          .replace(/\n/g, '\n ')
        // split up into words
          .split(hasNewLine ? '\n ' : ' ')
        // add back newline to the end of each for voice
          .map((word) => hasNewLine ? `${word}\n` : word)
        // get rid fo stray empties
          .filter(x => x.trim().length > 0)
      })
      .filter(x => x.length > 1 || x[0] !== '.')

    return sents
  }

  static wordifyPunctuation = (s:string):string => {
    let fixed = s.replace(/\r/g, '').replace(/\n/g, '')
    wordifiers.wordifications.forEach(w => {
      let myChars = w.characters
      const before = w.characters
      myChars = myChars.replace(/\?/g, '\\?')
        .replace(/\./g, '\\.')
        .replace(/\//g, '\\/')
      /*  if (before === 'HW?') {
        console.log(myChars)
      } */
      const fakeSpace = '|'
      if (!w.onlyAlone) {
        /* if (myChars === '<AR>') {
          console.log(`mychars:${myChars}`)
          console.log(`fixed:${fixed}`)
        } */
        const myRegex = new RegExp(`${myChars}`, 'gi')
        fixed = fixed.replace(myRegex, `${fakeSpace}${w.replacement}${fakeSpace}`)
      } else {
        // console.log(`mychars:${myChars}`)
        // guard state abbreviations from being part of a prosign
        // not all browsers suppor this
        // const myRegex = new RegExp(`\\b(?<!<)${myChars}\\b`, 'gi')
        // fixed = fixed.replace(myRegex, ` ${w.replacement} `)
        // if (before === 'HW?') {
        //   console.log(`fixed:${fixed}`)
        // }

        // TODO: for now we ignore multiline/spaces
        if (before.length === fixed.length) {
          const myRegex = new RegExp(`${myChars}`, 'gi')
          fixed = fixed.replace(myRegex, `${fakeSpace}${w.replacement}${fakeSpace}`)
        }
      }
    })
    return fixed
  }
}
