use std::collections::HashSet;

pub fn get_common_words() -> HashSet<&'static str> {
    let mut words = HashSet::new();
    let list = [
        "the", "be", "to", "of", "and", "a", "in", "that", "have", "I",
        "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
        "this", "but", "his", "by", "from", "they", "we", "say", "her", "she",
        "or", "an", "will", "my", "one", "all", "would", "there", "their", "what",
        "so", "up", "out", "if", "about", "who", "get", "which", "go", "me",
        "when", "make", "can", "like", "time", "no", "just", "him", "know", "take",
        "people", "into", "year", "your", "good", "some", "could", "them", "see", "other",
        "than", "then", "now", "look", "only", "come", "its", "over", "think", "also",
        "back", "after", "use", "two", "how", "our", "work", "first", "well", "way",
        "even", "new", "want", "because", "any", "these", "give", "day", "most", "us", "are", "is", "was", "were", "been", "has", "had", "do", "does", "did", "done",
        "go", "goes", "went", "gone", "got", "can", "could", "will", "would", "shall", "should", "may", "might", "must",
        "hello", "hi", "bye", "goodbye", "yes", "no", "please", "thank", "thanks", "sorry", "excuse",
        "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
        "first", "second", "third", "last", "next", "previous",
        "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
        "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december",
        "morning", "afternoon", "evening", "night", "day", "week", "month", "year",
        "today", "yesterday", "tomorrow", "now", "then", "later", "soon", "early", "late",
        "always", "usually", "often", "sometimes", "rarely", "never",
        "here", "there", "everywhere", "nowhere", "somewhere", "anywhere",
        "this", "that", "these", "those",
        "who", "what", "where", "when", "why", "how",
        "i", "you", "he", "she", "it", "we", "they",
        "me", "him", "her", "us", "them",
        "my", "your", "his", "its", "our", "their",
        "mine", "yours", "hers", "ours", "theirs",
        "myself", "yourself", "himself", "herself", "itself", "ourselves", "yourselves", "themselves",
        "a", "an", "the",
        "in", "on", "at", "to", "from", "by", "with", "for", "of", "about", "as", "into", "like", "through", "after", "over", "between", "out", "against", "during", "without", "before", "under", "around", "among",
        "and", "but", "or", "so", "because", "if", "when", "while", "although", "though", "even", "unless", "until", "since", "where",
        "very", "really", "too", "quite", "rather", "extremely", "totally", "completely", "absolutely",
        "good", "bad", "big", "small", "long", "short", "old", "new", "young", "happy", "sad", "fast", "slow", "hot", "cold", "warm", "cool", "hard", "soft", "easy", "difficult", "heavy", "light", "dark", "bright", "rich", "poor", "expensive", "cheap", "clean", "dirty", "beautiful", "ugly", "strong", "weak", "safe", "dangerous", "important", "unimportant", "true", "false", "right", "wrong", "interesting", "boring", "funny", "serious", "nice", "kind", "mean", "friendly", "unfriendly", "polite", "rude", "quiet", "noisy", "busy", "lazy", "lucky", "unlucky", "early", "late", "same", "different",
        "home", "house", "apartment", "room", "kitchen", "bathroom", "bedroom", "living", "dining", "garden", "garage", "school", "university", "college", "office", "work", "job", "business", "company", "store", "shop", "market", "supermarket", "restaurant", "cafe", "bar", "hotel", "hospital", "doctor", "dentist", "pharmacy", "police", "station", "fire", "post", "bank", "library", "museum", "park", "cinema", "theatre", "movie", "film", "music", "song", "book", "newspaper", "magazine", "letter", "email", "message", "phone", "computer", "internet", "website", "app", "game", "sport", "football", "soccer", "basketball", "tennis", "swimming", "running", "walking", "car", "bus", "train", "plane", "bicycle", "bike", "boat", "ship", "ticket", "money", "cash", "card", "price", "cost", "pay", "buy", "sell", "shopping", "clothes", "shirt", "pants", "shoes", "hat", "coat", "dress", "skirt", "bag", "watch", "glasses", "food", "drink", "water", "coffee", "tea", "milk", "juice", "bread", "cheese", "meat", "fish", "chicken", "fruit", "vegetable", "apple", "banana", "orange", "potato", "tomato", "onion", "carrot", "breakfast", "lunch", "dinner", "snack", "meal", "table", "chair", "sofa", "bed", "desk", "door", "window", "wall", "floor", "ceiling", "roof", "lamp", "light", "picture", "clock", "pen", "pencil", "paper", "notebook", "book", "dictionary", "map", "camera", "photo", "picture", "video", "television", "tv", "radio", "clock", "time", "hour", "minute", "second", "moment", "calendar", "date", "weather", "sun", "moon", "star", "sky", "cloud", "rain", "snow", "wind", "storm", "hot", "cold", "warm", "cool", "temperature", "degree", "season", "spring", "summer", "autumn", "winter", "animal", "dog", "cat", "bird", "fish", "horse", "cow", "pig", "sheep", "chicken", "mouse", "rat", "rabbit", "lion", "tiger", "elephant", "bear", "monkey", "snake", "insect", "spider", "fly", "bee", "mosquito", "tree", "flower", "grass", "plant", "forest", "mountain", "hill", "river", "lake", "ocean", "sea", "beach", "sand", "rock", "stone", "earth", "world", "country", "city", "town", "village", "street", "road", "building", "place", "area", "map", "direction", "north", "south", "east", "west", "left", "right", "up", "down", "front", "back", "center", "middle", "side", "top", "bottom", "inside", "outside", "near", "far", "here", "there",
        "family", "parent", "father", "mother", "dad", "mom", "son", "daughter", "brother", "sister", "grandfather", "grandmother", "grandpa", "grandma", "husband", "wife", "child", "children", "baby", "boy", "girl", "man", "men", "woman", "women", "person", "people", "friend", "colleague", "neighbor", "guest", "visitor", "boss", "manager", "staff", "employee", "student", "teacher", "professor", "doctor", "nurse", "police", "officer", "driver", "pilot", "cook", "chef", "waiter", "waitress", "actor", "actress", "artist", "musician", "writer", "singer", "dancer", "athlete", "player", "fan", "audience", "crowd",
        "color", "red", "blue", "green", "yellow", "orange", "purple", "pink", "brown", "black", "white", "gray", "gold", "silver",
        "body", "head", "hair", "face", "eye", "nose", "ear", "mouth", "tooth", "teeth", "tongue", "lip", "neck", "shoulder", "arm", "hand", "finger", "thumb", "chest", "stomach", "back", "leg", "knee", "foot", "feet", "toe", "skin", "blood", "heart", "brain", "bone", "muscle",
        "health", "sick", "ill", "well", "fine", "pain", "hurt", "break", "cut", "burn", "cough", "sneeze", "cold", "flu", "fever", "medicine", "pill", "doctor", "hospital", "ambulance", "emergency", "help",
        "problem", "question", "answer", "idea", "thought", "memory", "dream", "hope", "wish", "fear", "love", "hate", "like", "dislike", "joy", "sadness", "anger", "surprise", "fun", "joke", "game", "party", "holiday", "vacation", "trip", "travel", "journey", "visit", "meeting", "class", "lesson", "test", "exam", "grade", "score", "pass", "fail", "study", "learn", "teach", "read", "write", "speak", "listen", "understand", "know", "think", "believe", "agree", "disagree", "remember", "forget", "start", "stop", "finish", "begin", "end", "continue", "wait", "change", "stay", "leave", "arrive", "return", "enter", "exit", "open", "close", "lock", "unlock", "push", "pull", "lift", "drop", "throw", "catch", "hit", "kick", "run", "walk", "jump", "sit", "stand", "lie", "sleep", "wake", "eat", "drink", "cook", "wash", "clean", "wear", "dress", "buy", "sell", "pay", "cost", "save", "spend", "lose", "find", "search", "look", "watch", "see", "hear", "listen", "touch", "feel", "smell", "taste", "smile", "laugh", "cry", "shout", "whisper", "talk", "speak", "say", "tell", "ask", "answer", "call", "email", "text", "write", "read", "sign", "draw", "paint",
        "thing", "object", "item", "stuff", "piece", "part", "bit", "lot", "number", "amount", "size", "shape", "weight", "length", "width", "height", "depth", "distance", "speed", "quality", "quantity", "type", "kind", "sort", "group", "list", "set", "category", "level", "grade", "rank", "position", "place", "spot", "location", "area", "zone", "region", "country", "state", "city", "town", "village", "neighborhood", "street", "road", "way", "path", "track", "line", "point", "mark", "sign", "symbol", "word", "letter", "number", "picture", "image", "sound", "noise", "voice", "music", "light", "dark", "color", "red", "blue", "green", "yellow", "black", "white",
        "can", "could", "would", "should", "will", "may", "might", "must", "have", "had", "do", "did", "done", "am", "is", "are", "was", "were", "be", "been", "being",
        "have", "has", "had", "hav", "havin", "gonna", "wanna", "gotta", "lemme", "gimme", "prob", "probs", "dunno", "kinda", "sorta", "yeah", "yep", "nope", "nah", "uh", "um", "er", "ah", "oh", "ok", "okay", "hey", "hi", "bye", "wow", "cool", "great", "nice", "awesome", "perfect", "good", "bad", "happy", "sad", "angry", "tired", "hungry", "thirsty", "hot", "cold", "warm", "sunny", "rainy", "cloudy", "windy", "snowy",
    ];

    for word in list.iter() {
        words.insert(*word);
    }
    words
}
