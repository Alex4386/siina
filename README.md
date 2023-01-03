Siina
=====

**Siina Fork** with M****** Music Coding Support.  
 
> **Note**  
> M****** 에서 배포되는 "음악코딩" Channel 별 "Soundfont" Code를 Siina Soundfont JSON 으로 Migration 하는 과정에서 Siina와의 호환성 문제, 
> 기능의 부재 (`high`,`low` 그리고 일부 중첩 Modulation 적용, `feedback` 불가) 등으로 인해 완벽한 playback 은 불가능 합니다.  
>
> 당연하지만, 파싱코드가 엉망진창이라 "악보" 데이터가 정상적으로 파싱되지 않을 `"sudo"` 있습니다.  


패치 방법 안내
-----------
개발자가 바보인 관계로 소스코드 상에 적혀있던 "제3자" 의 인터넷 배포를 금한다는 내용을 보지 못했습니다.  
(= Upstream is NOT distributed under MIT License)  

따라서 제 변경 점 **만** MIT License로 배포합니다.  
`scripts/core/music_coding.js` 부분만 다운로드 받은 후, `siina.html` 에 script 태그로 로드하세요.

사용법
-----------
마땅한 GUI Component를 제대로 구현하지 않았기 때문에, 지금 현재로서는 Browser JavaScript Console 내에서 실행해야 합니다. 사용법은 직접 [./scripts/core/music_coding.js](./scripts/core/music_coding.js) 내용을 확인 해 주십시오.  

간단하게 요약하면 다음과 같이 사용할 수 있습니다:  
```js
// 새 음악코딩 파서 인스턴스 생성
const parser = new MusicCodingParser();
const song = parser.parseCode(`
$ The Lotteria Fryer Song

- Main
~sin1:1 +sin2:0.1 +sin3:0.32 +sin4:0.06 +sin5:0.05 +sin6:0.05 +sin8:0.02 +sin9:0.01 +sin10:0.01 +sin11:0.01 +sin12:0.01 !a10 !d3000 !s0 !r250

*bpm128

c4 1 0 d4 1 0 e4 1 0 c4 1 0 d4 1 0 e4 1 0 c4 1 0 d4 1 0 e4 1 0 g4 1 0
`)
// result -> [ channelInstance, ... ]

const player = new MusicCodingPlayer();
player.playChannel(song[0]);
```

지원을 왜 추가했는가?
-----------
 [Redacted] 에 주로 제공되는 "유사-MIDI" 시스템인 "악보" 의 자동플레이를 Siina 의 피아노 Visualization을 통해 직관적으로 볼 수 있는 점을 감안, 실용성이 좋을것으로 판단하여 추가하였습니다.  

 > **Note**  
 > 당직 중 갑자기 삘이 꽂혀서 작성한 코드로 Code Quality 가 썩 좋지 않으며,   
 > 코드 퀄리티와 더불어 상기 명시된 Siina의 한계점으로 인해 Code Coverage 가 좋지 않습니다.  

 <sup>~~사실 M******에 올라온 동방프로젝트 곡 들으려는 게 진짜 목적~~</sup>

Original
--------
 업스트림의 Readme는 [여기](/README.original.md)서 확인하세요
 
License
--------
제 변경점에 **한해!** MIT License 로 배포됩니다.  
업스트림의 라이선스는 업스트림 레포지토리의 siina.html 주석을 확인하세요.  
