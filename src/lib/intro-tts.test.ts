import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  countIntroSpeechUnits,
  estimateIntroLineDurationSeconds,
} from '@/lib/intro-tts'

describe('intro-tts speech unit counting', () => {
  it('counts whitespace-delimited Latin words', () => {
    assert.equal(countIntroSpeechUnits('Hello world again'), 3)
  })

  it('estimates Thai by character count when there are no spaces', () => {
    const thai =
      'เคยรู้สึกไหมว่าต้องจ้องมองหัวข้อข่าวไวรัลที่ดุเดือดปัญหาท้องถิ่นที่ซับซ้อนหรือข่าวด่วนแล้วสงสัยว่าความจริงที่แท้จริงคืออะไร'
    assert.ok(countIntroSpeechUnits(thai) > 25)
  })

  it('estimates compact-script line duration from character count', () => {
    const mandarin = '你是否曾经盯着一条疯传的标题？'
    assert.ok(estimateIntroLineDurationSeconds(mandarin) > 5)
  })
})
