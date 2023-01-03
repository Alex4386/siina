/**
 * Literally "bodged" Script for parsing "music coding" syntax
 * 
 *  by Alex4386
 *  proudly built with notepad.exe
 */

class MusicCodingPlayer {
    constructor() {

    }

    asyncWait(ms) {
        return new Promise((res) => setTimeout(res, ms));
    }

    forceRefreshUI() {
        const soundfontSelectElem = $q("#siina_top_container #soundfont_container #soundfont_select_list");

        const oscUI = new OscillatorControl();
        const infoPanel = new SoundfontInfoPanel();
        const masterUI = new MasterControl();

        $id("osc_container_content").innerHTML = "";
        $id("osc_container_content").append(oscUI.buildControlUI(engine.soundfont, "custom"));

        $id("soundfont_info_content").innerHTML = "";
        $id("soundfont_info_content").append(infoPanel.buildControlUI(engine.soundfont, "custom"));

        if (soundfontSelectElem.selectedOptions[0].attributes["name"].value === engine.soundfont.id) {
            soundfontSelectElem.selectedOptions[0].innerText = engine.soundfont.name;
        }
    }

    async play(target) {
        // stub
    }

    async playChannel(channel, ignoreIntendedSoundfont = false, showSoundfont = false) {
        const playingKeys = [];
        let wait = 0, i = 0, ms = 0;
        let intendedSoundfont = null;

        if (channel.actions) {
            while(true) {
                if (i >= channel.actions.length) {
                    // termination handling

                    await Promise.all(playingKeys.map(async n => { 
                        await this.asyncWait(n.playBeats * ms); 

                        const noteKey = n.note.toUpperCase();
                        const pianoKey = REGISTERED_PIANO_KEYS[noteKey];

                        if (pianoKey) pianoKey.releaseKey();
                    }));

                    playingKeys.splice(0, playingKeys.length);
                    break;
                }
                
                // process release tick
                for (const playingKey of playingKeys) {
                    if (playingKey.playBeats <= 0) {
                        const noteKey = playingKey.note.toUpperCase();
                        const pianoKey = REGISTERED_PIANO_KEYS[noteKey];

                        if (pianoKey) pianoKey.releaseKey();
                        playingKeys.splice(playingKeys.indexOf(playingKey), 1);
                    }
                }

                // if processing next tick requires wait, wait here.
                if (wait > 0) {
                    wait--;
                    await this.asyncWait(ms);

                    // run tick
                    for (const playingKey of playingKeys) {
                        playingKey.playBeats--;
                    }
                } else {
                    const action = channel.actions[i];
                    i++;

                    console.debug('running action:', action);
                    const actionType = action.action;

                    if (actionType === 'play_note') {
                        // use intendedSoundfont if exists.
                        if (intendedSoundfont && !ignoreIntendedSoundfont) engine.soudnfont = intendedSoundfont;

                        console.debug('Playing note', action.note, 'for', action.playBeats, 'beats and waiting for', action.delayBeats, 'beats');
                        playingKeys.push({
                            note: action.note,
                            playBeats: action.playBeats,
                        });

                        const noteKey = action.note.toUpperCase();
                        const pianoKey = REGISTERED_PIANO_KEYS[noteKey];

                        if (pianoKey) {
                            pianoKey.pressKey();
                        }

                        // TODO: properly propagate floating point beats.
                        if (action.delayBeats > 0) wait = action.delayBeats;
                    } else if (actionType === 'change_beatspeed') {
                        ms = action.ms;
                    } else if (actionType === 'delay') {
                        console.debug('Waiting',action.delayBeats,'beats');
                        wait = action.delayBeats;
                    } else if (actionType === 'switch_soundfont') {
                        intendedSoundfont = Soundfont.createSoundfontFromJson(action.soundfont);
                        if (showSoundfont) this.forceRefreshUI();
                    } else if (actionType === 'set_volume') {
                        if (intendedSoundfont) {
                            intendedSoundfont.masterAmp = action.volume;
                        } else {
                            engine.soundfont.masterAmp = action.volume;
                        }
                    } else {
                        console.error('unsupported action:', actionType);
                    }
                }
            }
        }

    }
}

class MusicCodingParser {
    constructor() {
        this.soundfontParser = new MusicCodingSoundfontParser();
    }

    isCodeNote(code) {
        return /^[a-g](?:#|)(?:[0-9]{1,}|)$/g.test(code);
    }

    isNumeric(code) {
        return /^[0-9\.]+$/.test(code);
    }

    getSetupZoneBeforeFirstNote(code) {
        const codes = code.split('\n').join(' ').split(' ');
        const firstNote = codes.find(n => this.isCodeNote(n) || this.isNumeric(n));
        const firstNoteIdx = !firstNote ? codes.length : codes.indexOf(firstNote);

        return codes.slice(0, firstNoteIdx).join(' ');
    }

    getFirstSoundfontSelection(code) {
        const codes = code.split('\n').join(' ').split(' ');

        // find first tilde character, which is initialization
        const firstSoundfont = codes.find(n => n.startsWith('~'));
        const firstSoundfontIdx = codes.indexOf(firstSoundfont);
        const soundfonts = codes.slice(firstSoundfontIdx);

        const firstNonSoundfont = soundfonts.find(n => !(['-','~','+','!'].map(o => n.startsWith(o)).reduce((a,b) => a || b)));
        const firstNonSoundfontIdx = soundfonts.indexOf(firstNonSoundfont);

        return soundfonts.slice(0, firstNonSoundfontIdx).join(' ');
    }

    getChannels(lineSeperatedCodes) {
        const channelIdxes = [];

        for (let i = 0; i < lineSeperatedCodes.length; i++) {
            if (lineSeperatedCodes[i].startsWith('-')) {
                channelIdxes.push(i);
            }
        }

        // in case there is only one channel or has only one channel definition, 
        // add 0 to indiciate index 0 has "virtual" channel marker 
        // since at least 1 channel should exist.
        if (channelIdxes.length === 0) channelIdxes.push(0);

        const channels = [];
        for (let i = 0; i < channelIdxes.length; i++) {
            const channelIdx = channelIdxes[i];
            const end = (i+1 === channelIdxes.length) ? lineSeperatedCodes.length : channelIdxes[i+1];

            channels.push(lineSeperatedCodes.slice(channelIdx, end));
        }

        return channels;
    }

    parseNoteCode(code) {
        // g#    3     0
        // note  play  delay
        //
        // if delay == 0, delay = play
        
        const parsed = code.split(' ');
        if (this.isNumeric(parsed[0]) && parsed.length) {
            // consider as delay.
            return [{
                action: "delay",
                delayBeats: parseFloat(parsed[0]),

                // code is included to debug with parsed result.
                code,
            }];
        } else if (this.isCodeNote(parsed[0])) {
            const firstNumeric = parsed.find(n => this.isNumeric(n));
            const notes = parsed.slice(0, parsed.indexOf(firstNumeric));
            const numerics = parsed.slice(parsed.indexOf(firstNumeric));

            // parsing error. too many numerics detected.
            if (numerics.length > 2) throw new Error("Invalid note code while parsing code as note-play code: "+code);

            const playBeats = parseFloat(numerics[0]);
            let delayBeats = parseFloat(numerics[1]);

            // due to "music coding" specs
            if (delayBeats === 0) {
                delayBeats = playBeats;
            }

            const results = [];
            for (let i = 0; i < notes.length; i++) {
                const note = notes[i];
                const realDelayBeats = ((i + 1 === notes.length) ? delayBeats : 0);
                const fakeCode = note+" "+playBeats+" "+realDelayBeats;

                results.push({
                    action: "play_note",
                    note,
                    playBeats,
                    delayBeats: realDelayBeats,
                    code: fakeCode,
                });
            }

            return results;
        } else {
            throw new Error("Invalid note code detected while trying to detect type of code: "+code);
        }
    }

    // TODO: This is cursed code! Fix ASAP!
    parseCode(code) {
        // remove jibberish and add make each line is a statement
        const rawCode = code.split('\n').map(n => {
            n = n.trim();

            const splitted = n.split(' ');
            if (n.startsWith('-') || n.startsWith('$')) {
                return n;
            } else if (splitted.length > 0 && (this.isCodeNote(splitted[0]) || this.isNumeric(splitted[0]))) {
                const resArr = [];
                const target = splitted;

                // detect end of statement and split by each.
                while (target.length > 0) {
                    let data = "";
                    let firstNumericIdx = undefined;

                    if (this.isCodeNote(splitted[0])) {
                        const firstNumeric = target.find(n => this.isNumeric(n));
                        firstNumericIdx = target.indexOf(firstNumeric);

                        data += target.slice(0, firstNumericIdx).join(" ");
                        target.splice(0, firstNumericIdx);

                        data += " ";
                    }

                    const firstNote = target.find(n => this.isCodeNote(n));
                    let firstNoteIdx = !firstNote ? target.length : target.indexOf(firstNote);

                    if (firstNumericIdx) {
                        if (firstNoteIdx > 2) firstNoteIdx = 2;
                    }

                    data += target.slice(0, firstNoteIdx).join(" ");
                    target.splice(0, firstNoteIdx);

                    resArr.push(data.trim());
                }

                return resArr.join('\n');
            } else {
                const target = [];
                for (let i = 0; i < splitted.length; i++) {
                    if (splitted[i] === "~" || splitted[i] === "+") {
                        const tmpName = splitted[i]+splitted[i+1];
                        target.push(tmpName);
                        i++;
                        continue;
                    }
                    target.push(splitted[i]);
                }
                return target.join("\n");
            }
        }).filter(n => n.trim() !== "").join('\n').split('\n');

        const name = (rawCode.find(n => n.startsWith('$')) ?? "$ ").replace(/^\$( |)/g, '');
        const channels = this.getChannels(rawCode);

        const parsedChannels = channels.map(channelCode => {
            let tempQueue = "";
            let inSoundfont = false, isComment = false;

            // extra for parsing last
            channelCode.push("");

            let bpm = -1;
            const actions = [];

            const channelNameCodeLine = channelCode.find(n => n.startsWith("-"));
            const name = channelNameCodeLine ? channelNameCodeLine.split("-").slice(1).join('-') : '';

            for (const code of channelCode) {
                if (code.startsWith('$')) {
                    actions.push({
                        action: 'comment',
                        code,
                        comment: code.split('$').slice(1).join('$'),
                    });
                    continue;
                } else if (code.startsWith('*')) {
                    actions.push({
                        action: 'change_beatspeed',
                        ms: this.parseTickMs(code),
                        code,
                    });
                    continue;
                } else if (['-','~','+'].map(o => code.startsWith(o)).reduce((a,b) => a || b) || /^\!(a|d|s|r)/g.test(code)) {
                    if (!inSoundfont) inSoundfont = true;
                    tempQueue += code+'\n';
                    continue;
                } else {
                    if (inSoundfont) {
                        const currentSoundfont = this.soundfontParser.parseCode(tempQueue);
                        actions.push({
                            action: 'switch_soundfont',
                            soundfont: currentSoundfont,
                            code: tempQueue.split('\n').join(' '),
                        });
                        inSoundfont = false;
                        tempQueue = '';
                    }
                }

                if (/^\%[0-9\.]+$/g.test(code)) {
                    const volume = parseFloat(code.split('%')[1]);
                    actions.push({
                        action: 'set_volume',
                        volume: volume / 100,
                    });
                    continue;                    
                }

                const splitted = code.split(' ');
                if (this.isNumeric(splitted[0]) || this.isCodeNote(splitted[0])) {
                    actions.push(...this.parseNoteCode(code));
                }
            }

            return {
                type: "channel",
                name,
                actions,
            };
        });

        return parsedChannels;
    }

    parseTickMs(code) {
        if (!code.startsWith('*')) {
            throw new Error("Invalid TickMS notation while parsing bpm code: "+code);
        }

        if (code.startsWith('*bpm')) {
            const targetBpm = parseInt(code.replace('*bpm', ''));
            return ((60*1000) / targetBpm) / 4;
        } else {
            const targetMs = parseFloat(code.replace('*', ''));
            return targetMs;
        }
    }
}

class MusicCodingSoundfontParser {
    constructor() {}

    parseCode(code) {
        let name = "Main"
        if (code.startsWith('-')) {
            name = code.split('\n')[0].split('-').slice(1).join('-');
        }

        const target = {
            name,
        }

        let osc = [];
        let adsr = { attack: 0, decay: 0, sustain: 0, release: 0 };

        const codeArgs = code.split('\n').join(' ').split(' ').map(n => n.trim());
        for (const arg of codeArgs) {
            if (arg.startsWith('~') || arg.startsWith('+')) {
                if (arg.startsWith('~')) {
                    osc = [];
                    adsr = { attack: 0, decay: 0, sustain: 1, release: 0 };
                }

                osc.push(this.parseOscillator(arg));
            }

            if (arg.startsWith('!')) {
                adsr = { ...adsr, ...this.parseADSR(arg) };
            }
        }

        return {
            display_name: name,
            id: Math.floor(Math.random() * 100000).toString(),
            author: "imported from music coding",
            description: "imported from music coding",
            attributes: {
                master_amp: {
                    value: 1,
                    adsr,
                },
                osc,
            },
        };
    }

    parseADSR(code) {
        if (!code.startsWith('!')) {
            throw new Error("Invalid ADSR declaration found while parsing code: "+code);
        }

        let tmpCode = code.slice(1);

        const target = tmpCode.charAt(0);
        tmpCode = tmpCode.slice(1);
        let value = parseFloat(tmpCode);

        switch(target) {
            case 'a':
                return { attack: Math.max(value / 1000, 0) };
            case 'd':
                return { decay: Math.max(value / 1000, 0) };
            case 's':
                return { sustain: Math.min(Math.max(value / 100, 0), 1) };
            case 'r':
                return { release: Math.max(value / 1000, 0) };
            default:
                throw new Error('Invalid ADSR declaration code "'+target+'" in code: '+code);
        }
    }

    parseOscillator(code) {
        if (!(['~', '+'].map(n => code.startsWith(n)).reduce((a,b) => a || b))) {
            throw new Error("Invalid Oscillator declaration code while parsing code: "+code);
        }

        let tmpCode = code.slice(1);
        let type = undefined;

        const availableTypes = ['sin', 'tri', 'saw', 'sqr', 'noise', 'low', 'high', 'feedback'];

        for (const targetType of availableTypes) {
            if (tmpCode.startsWith(targetType)) {
                type = targetType;
                tmpCode = tmpCode.slice(targetType.length);
            }
        }

        if (type === undefined) throw new Error("Invalid Oscillator declaration code while parsing oscillation type in code: "+code);
        let waveform = undefined;
        
        try {
            waveform = this.convertWaveformTypeName(type);
        } catch(e) {
            throw new Error("Siina currently doesn't support requested oscillation type: "+type);
        }

        let amp = 1, octave = 0, freq_offset = 0;
        if (tmpCode.includes(':')) {
            const parsed = tmpCode.split(':');

            const freqMultiplier = parseFloat(parsed[0]);
            octave = Math.log2(freqMultiplier);
            amp = parseFloat(parsed[1]);
        } else if (tmpCode.length > 0) {
            const freqMultiplier = parseFloat(tmpCode);
            octave = Math.log2(freqMultiplier);
        }

        return {
            waveform,
            amp,
            octave,
            freq_offset,
        }
    }

    convertWaveformTypeName(type) {
        switch(type) {
            case "sin":
                return "sine";
            case "saw":
                return "sawtooth";
            case "noise":
                return "noise";
            case "sqr":
                return "square";
            case "tri":
                return "triangle";
            default:
                throw new Error("Unsupported waveform type: "+type);
        }
    }
}