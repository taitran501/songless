import type { TrackAudioSourceType, TrackGenre } from "@/lib/tracks"

export interface CuratedSongSeed {
  id: string
  name: string
  artists: string
  genre: TrackGenre
  videoId: string
  sourceType: TrackAudioSourceType
  lyricsSnippets: string[]
}

export const CURATED_SONG_SEEDS: CuratedSongSeed[] = [
  {
    id: "usuk-blinding-lights",
    name: "Blinding Lights",
    artists: "The Weeknd",
    genre: "usuk",
    videoId: "fHI8X4OXluQ",
    sourceType: "official_audio",
    lyricsSnippets: [
    "I said, ooh, I'm blinded by the lights, No, I can't sleep until I feel your touch",
    "I'm just walking by to let you know, I can never say it on the phone",
    "Sin City's cold and empty, No one's around to judge me"
  ],
  },
  {
    id: "usuk-shape-of-you",
    name: "Shape of You",
    artists: "Ed Sheeran",
    genre: "usuk",
    videoId: "JGwWNGJdvx8",
    sourceType: "music_video",
    lyricsSnippets: [
    "The club isn't the best place to find a lover, So the bar is where I go",
    "I'm in love with the shape of you, We push and pull like a magnet do",
    "Girl, you know I want your love, Your love was handmade for somebody like me"
  ],
  },
  {
    id: "usuk-hello",
    name: "Hello",
    artists: "Adele",
    genre: "usuk",
    videoId: "T1tl66trXTQ",
    sourceType: "official_audio",
    lyricsSnippets: [
    "Hello from the other side, I must've called a thousand times",
    "Hello, it's me, I was wondering if after all these years you'd like to meet",
    "Hello from the outside, At least I can say that I've tried"
  ],
  },
  {
    id: "usuk-bad-guy",
    name: "bad guy",
    artists: "Billie Eilish",
    genre: "usuk",
    videoId: "4-TbQnONe_w",
    sourceType: "lyric_video",
    lyricsSnippets: [
    "So you're a tough guy, Like it really rough guy, Just can't get enough guy",
    "I'm that bad type, Make your mama sad type, Make your girlfriend mad tight",
    "White shirt now red, my bloody nose, Sleepin' on your tippy toes"
  ],
  },
  {
    id: "usuk-blank-space",
    name: "Blank Space",
    artists: "Taylor Swift",
    genre: "usuk",
    videoId: "e-ORhEE9VVg",
    sourceType: "music_video",
    lyricsSnippets: [
    "Got a long list of ex-lovers, They'll tell you I'm insane, But I've got a blank space, baby, And I'll write your name",
    "Nice to meet you, where you been? I could show you incredible things",
    "Cause darling I'm a nightmare dressed like a daydream"
  ],
  },
  {
    id: "usuk-levitating",
    name: "Levitating",
    artists: "Dua Lipa",
    genre: "usuk",
    videoId: "WHuBW3qKm9g",
    sourceType: "lyric_video",
    lyricsSnippets: [
    "If you wanna run away with me, I know a galaxy And I can take you for a ride",
    "I got you, moonlight, you're my starlight, I need you all night, come on, dance with me",
    "You're the shooting star I see, A vision of ecstasy"
  ],
  },
  {
    id: "usuk-as-it-was",
    name: "As It Was",
    artists: "Harry Styles",
    genre: "usuk",
    videoId: "V1Z586zoeeE",
    sourceType: "official_audio",
    lyricsSnippets: [
    "In this world, it's just us, You know it's not the same as it was",
    "Holdin' me back, Gravity's holdin' me back",
    "Answer the phone, Harry, you're no good alone, Why are you sitting at home on the floor?"
  ],
  },
  {
    id: "usuk-uptown-funk",
    name: "Uptown Funk",
    artists: "Mark Ronson, Bruno Mars",
    genre: "usuk",
    videoId: "7Ya2U8XN_Zw",
    sourceType: "official_audio",
    lyricsSnippets: [
    "Girls hit your hallelujah (whuoo), 'Cause uptown funk gon' give it to you",
    "This hit, that ice cold, Michelle Pfeiffer, that white gold",
    "Stop, wait a minute, Fill my cup, put some liquor in it"
  ],
  },
  {
    id: "usuk-believer",
    name: "Believer",
    artists: "Imagine Dragons",
    genre: "usuk",
    videoId: "IhP3J0j9JmY",
    sourceType: "official_audio",
    lyricsSnippets: [
    "Pain! You made me a, you made me a believer, believer",
    "First things first, I'ma say all the words inside my head",
    "I was broken from a young age, Taking my sulking to the masses"
  ],
  },
  {
    id: "usuk-roar",
    name: "Roar",
    artists: "Katy Perry",
    genre: "usuk",
    videoId: "mwL1cohnHNE",
    sourceType: "lyric_video",
    lyricsSnippets: [
    "I got the eye of the tiger, a fighter, dancing through the fire, 'Cause I am a champion and you're gonna hear me roar",
    "I used to bite my tongue and hold my breath, Scared to rock the boat and make a mess",
    "You held me down, but I got up, Already brushing off the dust"
  ],
  },
  {
    id: "usuk-someone-like-you",
    name: "Someone Like You",
    artists: "Adele",
    genre: "usuk",
    videoId: "22c3_LoIfZQ",
    sourceType: "official_audio",
    lyricsSnippets: [
    "Never mind, I'll find someone like you, I wish nothing but the best for you, too",
    "I heard that you're settled down, That you found a girl and you're married now",
    "Sometimes it lasts in love, but sometimes it hurts instead"
  ],
  },
  {
    id: "usuk-sunflower",
    name: "Sunflower",
    artists: "Post Malone, Swae Lee",
    genre: "usuk",
    videoId: "ApXoWvfEYVU",
    sourceType: "music_video",
    lyricsSnippets: [
    "Then you're left in the dust, unless I stuck by ya, You're the sunflower, I think your love would be too much",
    "Needless to say, I keep her in check, She was all bad-bad, nevertheless",
    "Every time I'm leavin' on ya, You don't make it easy, no, no"
  ],
  },
  {
    id: "vpop-hay-trao-cho-anh",
    name: "Hay Trao Cho Anh",
    artists: "Son Tung M-TP",
    genre: "vpop",
    videoId: "G8IlfFMt3so",
    sourceType: "lyric_video",
    lyricsSnippets: [
    "Hãy trao cho anh, hãy trao cho anh, hãy trao cho anh thứ anh đang mong chờ",
    "Hình bóng ai đó nhẹ nhàng vụt qua nơi đây, Quyến rũ ngây ngất loạn nhịp làm tim mê say",
    "Chạm nhau mang vô vàn đắm đuối vấn vương dâng tràn, Lấp kín chốn nhân gian"
  ],
  },
  {
    id: "vpop-see-tinh",
    name: "See Tinh",
    artists: "Hoang Thuy Linh",
    genre: "vpop",
    videoId: "UfMEtjxzpBk",
    sourceType: "official_audio",
    lyricsSnippets: [
    "Giây phút em gặp anh là em biết em see tình, Tình đừng tình toang toang tính toang tình mình tình tang tang tang",
    "Uây uây uây uây, Nhớ điên đầu mà lại thấy sao vui vui vui vui",
    "Anh ơi anh à, anh có bùa ngải hay chơi ma trận"
  ],
  },
  {
    id: "vpop-nang-tho",
    name: "Nang Tho",
    artists: "Hoang Dung",
    genre: "vpop",
    videoId: "0SJAzTGh1SE",
    sourceType: "official_audio",
    lyricsSnippets: [
    "Em không là nàng thơ, anh cũng không còn là nhạc sĩ mộng mơ",
    "Ta gặp nhau vào một ngày thu tháng mười, nụ cười em nhuốm màu nắng",
    "Tình yêu này ngắm trăng trăng tan, ngắm hoa hoa tàn"
  ],
  },
  {
    id: "vpop-co-chac-yeu-la-day",
    name: "Co Chac Yeu La Day",
    artists: "Son Tung M-TP",
    genre: "vpop",
    videoId: "6t-MjBazs3o",
    sourceType: "music_video",
    lyricsSnippets: [
    "Có chắc yêu là đây đây đây, Có chắc yêu là đây đây",
    "Thấp thoáng ánh mắt đôi môi mang theo hương mê say, Em cho anh tan trong miên man quên luôn đi đêm ngày",
    "Có câu ca trong gió hát ngân nga ru trời mây, Nhẹ nhàng đón ban mai ngang qua trao nụ cười"
  ],
  },
  {
    id: "vpop-buoc-qua-nhau",
    name: "Buoc Qua Nhau",
    artists: "Vu",
    genre: "vpop",
    videoId: "ixdSsW5n2rI",
    sourceType: "music_video",
    lyricsSnippets: [
    "Một chiều thu man mác hơi sương, chân bước qua đời nhau, để làm nhau đau",
    "Chỉ là đôi môi, chỉ là vài câu chào, bỗng chốc yêu thương mỏng manh tựa sương khói",
    "Dấu vết cứ để lại đây, chỉ là thời gian sao không mờ phai"
  ],
  },
  {
    id: "vpop-de-vuong",
    name: "De Vuong",
    artists: "Dinh Dung",
    genre: "vpop",
    videoId: "qkPgUgkQE4Y",
    sourceType: "music_video",
    lyricsSnippets: [
    "Một bậc quân vương mang trong con tim hình hài đất nước, ngỡ như dân an ta sẽ chẳng bao giờ buồn",
    "Nào ngờ một hôm ngao du nhân gian chạm một ánh mắt, khiến cho ta say ta mê như chốn thiên đường",
    "Lòng sầu miên man thao thức cớ sao ta lại lỡ yêu một nàng thứ dân"
  ],
  },
  {
    id: "vpop-noi-nay-co-anh",
    name: "Noi Nay Co Anh",
    artists: "Son Tung M-TP",
    genre: "vpop",
    videoId: "FN7ALfpGxiI",
    sourceType: "music_video",
    lyricsSnippets: [
    "Cầm tay anh, dựa vai anh, kề bên anh nơi này có anh",
    "Gió mang đi niềm vui bước qua nơi đây bao ưu sầu",
    "Mùa xuân đến bình yên cho anh những giấc mơ"
  ],
  },
  {
    id: "vpop-lac-troi",
    name: "Lac Troi",
    artists: "Son Tung M-TP",
    genre: "vpop",
    videoId: "WQU8avEv6CQ",
    sourceType: "lyric_video",
    lyricsSnippets: [
    "Người theo hương hoa mây mù giăng lối, làn sương khói phôi phai đưa bước ai xa rồi",
    "Trôi dạt về chốn phương nào, chốn thiên nhai hải giác có bóng hình ai",
    "Mười năm mong nhớ, mười năm chờ đợi, hỡi giai nhân sao vội quay mặt đi"
  ],
  },
  {
    id: "vpop-co-em-cho",
    name: "Co Em Cho",
    artists: "MIN, Mr A",
    genre: "vpop",
    videoId: "PqS2YDItY3Y",
    sourceType: "lyric_video",
    lyricsSnippets: [
    "Ngoài kia nếu có khó khăn quá về nhà anh nhé, có em chờ",
    "Người đàn ông em yêu đôi khi có những phút giây yếu đuối",
    "Một mình anh gánh vác cả thế giới trên vai"
  ],
  },
  {
    id: "vpop-sau-tat-ca",
    name: "Sau Tat Ca",
    artists: "ERIK",
    genre: "vpop",
    videoId: "XaXiLdlgMo0",
    sourceType: "official_audio",
    lyricsSnippets: [
    "Sau tất cả mình lại trở về với nhau, tựa như chưa bắt đầu, tựa như ta vừa mới quen",
    "Chỉ vì một phút nông nổi, ta đã vô tình đánh mất nhau",
    "Sau tất cả, mình lại chung lối đi, đoạn đường ta bước chung nay thêm muôn phần đẹp hơn"
  ],
  },
  {
    id: "vpop-anh-nha-o-dau-the",
    name: "Anh Nha O Dau The",
    artists: "AMEE, B Ray",
    genre: "vpop",
    videoId: "aMW2Yf7PxM4",
    sourceType: "official_audio",
    lyricsSnippets: [
    "Anh nhà ở đâu thế? Cứ tới lui trong tim tôi chẳng nhớ đường về à",
    "Đôi mắt âu sầu, cất giấu bao nỗi niềm",
    "Tôi ngẩn ngơ trông theo bóng anh đi về"
  ],
  },
  {
    id: "vpop-co-chang-trai-viet-len-cay",
    name: "Co Chang Trai Viet Len Cay",
    artists: "Phan Manh Quynh",
    genre: "vpop",
    videoId: "EUEUZDV-in0",
    sourceType: "lyric_video",
    lyricsSnippets: [
    "Có chàng trai viết lên cây, lời yêu thương cô gái ấy, mối tình như gió như mây, nhiều năm trôi qua vẫn thấy",
    "Mùa thu đi qua, mùa đông tìm đến, cô gái năm nào nay đã rời xa",
    "Lá rơi bên thềm, gợi nhớ bao kỷ niệm ngọt ngào"
  ],
  },
  {
    id: "rap-see-you-again",
    name: "See You Again",
    artists: "Wiz Khalifa, Charlie Puth",
    genre: "rap",
    videoId: "xl8thVrlvjI",
    sourceType: "official_audio",
    lyricsSnippets: [
    "It's been a long day without you, my friend, And I'll tell you all about it when I see you again",
    "We've come a long way from where we began",
    "Oh, I'll tell you all about it when I see you again"
  ],
  },
  {
    id: "rap-gods-plan",
    name: "God's Plan",
    artists: "Drake",
    genre: "rap",
    videoId: "xpVfcZ0ZcFM",
    sourceType: "music_video",
    lyricsSnippets: [
    "God's plan, God's plan, I hold back, sometimes I won't, yuh",
    "She say, Do you love me? I tell her, Only partly",
    "I only love my bed and my momma, I'm sorry"
  ],
  },
  {
    id: "rap-sicko-mode",
    name: "SICKO MODE",
    artists: "Travis Scott",
    genre: "rap",
    videoId: "d-JBBNg8YKs",
    sourceType: "official_audio",
    lyricsSnippets: [
    "Out in nature, late in the night, Sun is down, freezin' cold, That's how we already know winter's here",
    "Yeah, I'm in my bag, but I'm in his too",
    "She thought it was the ocean, it's just the pool"
  ],
  },
  {
    id: "rap-bigcityboi",
    name: "Bigcityboi",
    artists: "Binz",
    genre: "rap",
    videoId: "jgZkrA8E5do",
    sourceType: "music_video",
    lyricsSnippets: [
    "Nghiện thuốc có thể Lào Cai, nhưng nghiện em không thể nào cai",
    "Trói em bằng cà vạt, penhouse trên Đà Lạt",
    "Không cần săn đón, em vẫn là tâm điểm"
  ],
  },
  {
    id: "rap-bai-nay-chill-phet",
    name: "Bai Nay Chill Phet",
    artists: "Den, MIN",
    genre: "rap",
    videoId: "xEXyWsgk9EY",
    sourceType: "official_audio",
    lyricsSnippets: [
    "Nếu mà mệt quá, giữa thành phố sống chồng lên nhau, cùng lắm thì mình về quê, mình nuôi cá và trồng thêm rau",
    "Em dạo này ổn không? Còn đi làm ở công ty cũ?",
    "Đêm nay vi vu đôi ba dặm đường, em ơi có khi ta chẳng cần giường"
  ],
  },
  {
    id: "rap-exs-hate-me",
    name: "Ex's Hate Me",
    artists: "B Ray, Masew, AMEE",
    genre: "rap",
    videoId: "ff7dvE-4mMA",
    sourceType: "lyric_video",
    lyricsSnippets: [
    "Tất cả người yêu cũ đều ghét anh, Không một ai trong số họ muốn làm bạn",
    "Họ khuyên em nên tránh xa anh ra, vì anh là một gã tồi",
    "Và anh sẽ mang đến cho em, những tổn thương không đáng có"
  ],
  },
]
