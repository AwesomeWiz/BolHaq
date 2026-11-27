import type { Locale } from './index'

export const tourSteps = ['language', 'site', 'mic', 'review', 'reports'] as const
export type TourStep = typeof tourSteps[number]

type TourMessages = {
  start: string; restart: string; previous: string; next: string; skip: string; finish: string
  progress: string; replay: string; unavailable: string; tryAudio: string; focusTarget: string; example: string
  preview: string; previewSite: string; reviewNote: string
  steps: Record<TourStep, readonly [title: string, instruction: string]>
}

const messages: Record<Locale, TourMessages> = {
  'en-IN': {
    start: 'Start guided tour', restart: 'Restart guided tour', previous: 'Previous', next: 'Next',
    skip: 'Skip tour', finish: 'Finish', progress: 'Step {step} of {total}',
    replay: 'Replay narration', unavailable: 'Narration is unavailable in this language on this device.',
    tryAudio: 'Audio could not play. Tap Replay narration to try again.', focusTarget: 'Go to highlighted control',
    example: 'Try saying', preview: 'Example only. Nothing here is saved.', previewSite: 'Example worksite',
    reviewNote: 'Guided tour: Check the worksite, date, and amount before you confirm.',
    steps: {
      language: ['Choose your language', 'Choose the language you’re comfortable using. You can change it at any time.'],
      site: ['Add a worksite', 'Add the employer or worksite where you work. You can do this now or continue the tour.'],
      mic: ['Use your voice', 'Tap the microphone and speak naturally to record work or payments.'],
      review: ['Review before saving', 'BolHaq shows what it understood. Check the details before you save.'],
      reports: ['Check wages and reports', 'Check pending wages, view wage statements, and prepare payment reminders.'],
    },
  },
  'hi-IN': {
    start: 'ऐप का परिचय शुरू करें', restart: 'ऐप का परिचय फिर से देखें', previous: 'पिछला', next: 'आगे',
    skip: 'परिचय छोड़ें', finish: 'पूरा करें', progress: 'चरण {step} / {total}',
    replay: 'निर्देश फिर से सुनें', unavailable: 'इस डिवाइस पर इस भाषा में निर्देश सुनने की सुविधा उपलब्ध नहीं है।',
    tryAudio: 'आवाज़ नहीं चली। फिर से सुनने वाला बटन दबाएँ।', focusTarget: 'दिखाए गए बटन पर जाएँ',
    example: 'ऐसे बोलकर देखें', preview: 'यह सिर्फ़ उदाहरण है। यहाँ कुछ भी सेव नहीं होगा।', previewSite: 'उदाहरण का कार्यस्थल',
    reviewNote: 'ऐप का परिचय। पुष्टि करने से पहले कार्यस्थल, तारीख और रकम जाँचें।',
    steps: {
      language: ['अपनी भाषा चुनें', 'जिस भाषा में आप सहज हैं, उसे चुनें। आप इसे कभी भी बदल सकते हैं।'],
      site: ['कार्यस्थल जोड़ें', 'जहाँ काम करते हैं, उस जगह या नियोक्ता को जोड़ें। यह आप अभी या बाद में कर सकते हैं।'],
      mic: ['बोलकर दर्ज करें', 'माइक्रोफ़ोन दबाएँ और अपने काम या मिले हुए पैसों के बारे में बोलें।'],
      review: ['सेव करने से पहले जाँचें', 'BolHaq दिखाता है कि उसने क्या समझा। सेव करने से पहले जानकारी जाँच लें।'],
      reports: ['मज़दूरी का हिसाब देखें', 'बाकी मज़दूरी और हिसाब देखें। पैसे माँगने के लिए संदेश भी तैयार कर सकते हैं।'],
    },
  },
  'ml-IN': {
    start: 'ആപ്പ് പരിചയപ്പെടാം', restart: 'ആപ്പ് വീണ്ടും പരിചയപ്പെടാം', previous: 'മുമ്പത്തേത്', next: 'അടുത്തത്',
    skip: 'പരിചയം ഒഴിവാക്കുക', finish: 'പൂർത്തിയാക്കുക', progress: '{total} ൽ {step}ാം ഘട്ടം',
    replay: 'നിർദ്ദേശം വീണ്ടും കേൾക്കുക', unavailable: 'ഈ ഉപകരണത്തിൽ ഈ ഭാഷയിൽ നിർദ്ദേശങ്ങൾ കേൾക്കാനാവില്ല.',
    tryAudio: 'ശബ്ദം കേൾപ്പിക്കാനായില്ല. വീണ്ടും കേൾക്കാനുള്ള ബട്ടൺ അമർത്തുക.', focusTarget: 'കാണിച്ചിരിക്കുന്ന ബട്ടണിലേക്ക് പോകുക',
    example: 'ഇങ്ങനെ പറഞ്ഞുനോക്കൂ', preview: 'ഇത് ഒരു ഉദാഹരണം മാത്രം. ഇവിടെ ഒന്നും സേവ് ചെയ്യില്ല.', previewSite: 'ഉദാഹരണ ജോലിസ്ഥലം',
    reviewNote: 'ആപ്പ് പരിചയം. ഉറപ്പാക്കുന്നതിനു മുമ്പ് ജോലിസ്ഥലം, തീയതി, തുക എന്നിവ പരിശോധിക്കുക.',
    steps: {
      language: ['ഭാഷ തിരഞ്ഞെടുക്കുക', 'നിങ്ങൾക്ക് സൗകര്യമുള്ള ഭാഷ തിരഞ്ഞെടുക്കുക. ഭാഷ എപ്പോൾ വേണമെങ്കിലും മാറ്റാം.'],
      site: ['ജോലിസ്ഥലം ചേർക്കുക', 'നിങ്ങൾ ജോലി ചെയ്യുന്ന സ്ഥലമോ തൊഴിലുടമയെയോ ചേർക്കുക. ഇപ്പോഴോ പിന്നീടോ ചേർക്കാം.'],
      mic: ['സംസാരിച്ച് രേഖപ്പെടുത്തുക', 'മൈക്രോഫോൺ അമർത്തി ചെയ്ത ജോലിയെക്കുറിച്ചോ കിട്ടിയ കൂലിയെക്കുറിച്ചോ പറയുക.'],
      review: ['സേവ് ചെയ്യുന്നതിനു മുമ്പ് പരിശോധിക്കുക', 'BolHaq മനസ്സിലാക്കിയ വിവരങ്ങൾ കാണിക്കും. സേവ് ചെയ്യുന്നതിനു മുമ്പ് അവ പരിശോധിക്കുക.'],
      reports: ['കൂലിയും കണക്കും നോക്കുക', 'ബാക്കി കൂലിയും കണക്കും നോക്കാം. കൂലി ചോദിക്കാൻ സന്ദേശവും തയ്യാറാക്കാം.'],
    },
  },
}

export const onboarding = (locale: Locale) => messages[locale]
