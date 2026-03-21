import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { dailyFeedBuilder } from '../services/dailyFeedBuilder';

const prisma = new PrismaClient();

const SAMPLE_BOOKS = [
  {
    title: 'Atomic Habits',
    author: 'James Clear',
    categories: ['Self-Help', 'Psychology', 'Business'],
    purchaseLink: 'https://www.amazon.com/dp/0735211299',
  },
  {
    title: 'Sapiens',
    author: 'Yuval Noah Harari',
    categories: ['History', 'Science', 'Philosophy'],
    purchaseLink: 'https://www.amazon.com/dp/0062316117',
  },
  {
    title: 'The Psychology of Money',
    author: 'Morgan Housel',
    categories: ['Business', 'Psychology', 'Self-Help'],
    purchaseLink: 'https://www.amazon.com/dp/0857197681',
  },
  {
    title: 'Thinking, Fast and Slow',
    author: 'Daniel Kahneman',
    categories: ['Psychology', 'Science', 'Business'],
    purchaseLink: 'https://www.amazon.com/dp/0374533555',
  },
  {
    title: 'The Alchemist',
    author: 'Paulo Coelho',
    categories: ['Fiction', 'Philosophy', 'Self-Help'],
    purchaseLink: 'https://www.amazon.com/dp/0062315005',
  },
  {
    title: 'Deep Work',
    author: 'Cal Newport',
    categories: ['Self-Help', 'Business', 'Technology'],
    purchaseLink: 'https://www.amazon.com/dp/1455586692',
  },
  {
    title: 'Man\'s Search for Meaning',
    author: 'Viktor Frankl',
    categories: ['Philosophy', 'Psychology', 'Biography'],
    purchaseLink: 'https://www.amazon.com/dp/0807014273',
  },
  {
    title: 'The 48 Laws of Power',
    author: 'Robert Greene',
    categories: ['Business', 'History', 'Psychology'],
    purchaseLink: 'https://www.amazon.com/dp/0140280197',
  },
  {
    title: 'Shoe Dog',
    author: 'Phil Knight',
    categories: ['Biography', 'Business'],
    purchaseLink: 'https://www.amazon.com/dp/1501135929',
  },
  {
    title: 'The Power of Now',
    author: 'Eckhart Tolle',
    categories: ['Spirituality', 'Philosophy', 'Self-Help'],
    purchaseLink: 'https://www.amazon.com/dp/1577314808',
  },
];

interface StoryInput {
  bookIndex: number;
  title: string;
  content: string;
  readingTimeMinutes: number;
  tone: string;
  categories: string[];
  storyGroupId?: string;
}

// ─── ALL STORIES ─────────────────────────────────────────────────────────────
// Grouped by book. Multiple reading times per concept where relevant.

function buildStories(): StoryInput[] {
  const stories: StoryInput[] = [];

  // ── Atomic Habits ─────────────────────────────────────────────────────────

  const g1 = uuid();
  stories.push({
    bookIndex: 0, storyGroupId: g1,
    title: 'The British Cycling Revolution',
    readingTimeMinutes: 1, tone: 'inspiring',
    categories: ['Self-Help', 'Psychology', 'Business'],
    content: `In 2003, British cycling was a joke. One Olympic gold in a century. Bike manufacturers refused to sell to the team — it would hurt their brand.

Then Dave Brailsford took over with a deceptively simple idea: improve everything by just 1%. Redesigned seats. Better massage gels. Taught riders how to wash hands to avoid colds. Painted the team truck interior white to spot dust that could degrade bikes.

Five years later, Britain dominated the 2008 Olympics — 60% of track cycling golds. Then five Tour de France wins in six years.

The lesson: habits are compound interest for self-improvement. Tiny changes, massive results.`,
  });

  stories.push({
    bookIndex: 0, storyGroupId: g1,
    title: 'The British Cycling Revolution',
    readingTimeMinutes: 3, tone: 'inspiring',
    categories: ['Self-Help', 'Psychology', 'Business'],
    content: `In 2003, the fate of British cycling was about to change forever. Dave Brailsford had just been appointed as the new performance director of British Cycling, and he came armed with an idea so simple it bordered on absurd.

For over a century, British cyclists had been the punchline of professional cycling. They'd managed just a single gold medal at the Olympic Games in nearly a hundred years. The situation was so dire that one of Europe's top bike manufacturers actually refused to sell bikes to the British team — worried it would hurt their brand.

Brailsford's strategy? Something he called "the aggregation of marginal gains." The philosophy was disarmingly simple: search for a tiny margin of improvement in everything you do.

His team redesigned the bike seats, making them more comfortable. They tested different fabrics for the racing suits in a wind tunnel. They switched to indoor racing suits that were lighter. They hired a surgeon to teach riders the best way to wash their hands — reducing the chances of catching a cold.

They tested different types of massage gels, looking for the one that led to the fastest muscle recovery. They even painted the inside of the team truck white, so they could spot little bits of dust that would normally slip by unnoticed but might degrade the performance of finely tuned racing bikes.

The results were staggering. Just five years after Brailsford took over, the British cycling team dominated the 2008 Olympic Games in Beijing, winning 60% of the gold medals available in track cycling. Four years later, at the London Olympics, they set nine Olympic records and seven world records.

That same year, Bradley Wiggins became the first British cyclist to win the Tour de France. The following year, his teammate Chris Froome won the race — then again in 2015, 2016, and 2017.

The lesson is striking: habits are the compound interest of self-improvement. Getting 1% better every day counts for a lot in the long run.`,
  });

  const g2 = uuid();
  stories.push({
    bookIndex: 0, storyGroupId: g2,
    title: 'The Ice Cube on the Table',
    readingTimeMinutes: 1, tone: 'philosophical',
    categories: ['Self-Help', 'Psychology'],
    content: `Imagine an ice cube sitting on a table at 25°F. You raise the temperature one degree at a time. 26°. 27°. 28°. Nothing happens. 29°. 30°. 31°. Still nothing.

Then 32°F — and the ice begins to melt. One degree, seemingly no different from all the ones before, unlocks a massive change.

This is how habits work. You work for weeks, months, years — nothing seems to happen. Then everything breaks through at once. People call it overnight success. You know the truth: the work was happening all along.`,
  });

  const g3 = uuid();
  stories.push({
    bookIndex: 0, storyGroupId: g3,
    title: 'The Paperclip Strategy',
    readingTimeMinutes: 1, tone: 'inspiring',
    categories: ['Self-Help', 'Business'],
    content: `A 23-year-old stockbroker named Trent Dyrsmid placed 120 paper clips in a jar every morning. Each time he made a sales call, he moved one clip to a second jar. He wouldn't leave until all 120 were moved.

Within 18 months, Dyrsmid was bringing in $5 million to the firm.

The strategy had nothing to do with talent. It was about making the right behavior visible and satisfying. Each clip was proof he was showing up. The system removed the need for motivation and replaced it with a simple, repeatable action.`,
  });

  const g4 = uuid();
  stories.push({
    bookIndex: 0, storyGroupId: g4,
    title: 'The Four Laws of Behavior Change',
    readingTimeMinutes: 3, tone: 'inspiring',
    categories: ['Self-Help', 'Psychology'],
    content: `A young woman named Patty moved to a new city for work. She'd always struggled with exercise — joining gyms and quitting within weeks. But this time, something clicked, and it had nothing to do with willpower.

Her new apartment happened to be directly above a small gym. Every morning, she'd walk past the entrance on her way to get coffee. The gym's glass doors meant she could see people working out — a constant visual cue.

One morning, out of sheer convenience, she walked in. She did ten minutes on the treadmill and left. No grand commitment. No ambitious plan. Just ten minutes because it was right there.

She started going three times a week, then five. Within six months, Patty had run her first 5K. She hadn't suddenly become a "fitness person." The environment had simply made the habit obvious, easy, and satisfying.

This illustrates the four laws of behavior change: make it obvious, make it attractive, make it easy, and make it satisfying. You don't rise to the level of your goals — you fall to the level of your systems. Patty didn't need more motivation. She needed a better system.

Every action you take is a vote for the type of person you want to be. No single instance will transform your beliefs, but as the votes build up, so does the evidence of your new identity.`,
  });

  stories.push({
    bookIndex: 0,
    title: 'The Man Who Couldn\'t Stop Eating',
    readingTimeMinutes: 3, tone: 'cautionary',
    categories: ['Self-Help', 'Psychology'],
    content: `In the 1960s, a researcher at the University of Pennsylvania conducted an experiment that would forever change our understanding of desire. He gave a group of volunteers a simple task: eat soup.

There was a catch. Half the bowls were secretly rigged — they were connected to hidden tubes beneath the table that slowly refilled the bowl as participants ate. The people with normal bowls stopped eating when they saw the bowl was empty. The people with bottomless bowls? They just kept going. And going.

On average, those with the bottomless bowls consumed 73% more soup than those with normal bowls. When asked if they felt full, most of them said no. Their eyes, not their stomachs, were making the decisions.

This is the terrifying truth about human behavior: we are often controlled not by our intentions or our hunger, but by the cues in our environment. The size of a plate, the location of a snack, the visibility of a temptation — these seemingly trivial details drive enormous amounts of behavior.

The solution isn't more willpower. It's redesigning your environment. Want to eat less? Use smaller plates. Want to read more? Leave a book on your pillow. Want to check your phone less? Leave it in another room. Every habit is initiated by a cue, and you can architect which cues surround you.

The most disciplined people aren't people with extraordinary self-control. They're people who have structured their lives so they require less of it.`,
  });

  stories.push({
    bookIndex: 0,
    title: 'The Goldilocks Rule',
    readingTimeMinutes: 1, tone: 'educational',
    categories: ['Self-Help', 'Psychology'],
    content: `Humans experience peak motivation when working on tasks that are right on the edge of their current abilities. Not too hard. Not too easy. Just right.

This is the Goldilocks Rule. A tennis player who plays against someone much worse gets bored. Against someone much better, they get demoralized. But against someone just slightly better? They enter a state of flow.

The greatest threat to success is not failure — it's boredom. Habits become routine, and routine becomes boring. The people who stick with their habits are the ones who find ways to keep themselves on the edge. Mastery requires practice. But practice requires endurance. And endurance requires that you fall in love with boredom.`,
  });

  // ── Sapiens ───────────────────────────────────────────────────────────────

  const g5 = uuid();
  stories.push({
    bookIndex: 1, storyGroupId: g5,
    title: 'The Cognitive Revolution',
    readingTimeMinutes: 3, tone: 'dramatic',
    categories: ['History', 'Science', 'Philosophy'],
    content: `About 70,000 years ago, something extraordinary happened inside the minds of Homo sapiens. Historians call it the Cognitive Revolution — the moment our species gained the ability to think in entirely new ways.

Before this shift, humans were unremarkable animals. We had bigger brains than most creatures, sure, but we occupied a middle position in the food chain. We hunted small game, gathered what we could, and spent a lot of time avoiding predators.

Then, seemingly overnight in evolutionary terms, everything changed. Sapiens began producing boats, oil lamps, bows and arrows. They created art — cave paintings that still take your breath away 40,000 years later. They developed trade networks spanning hundreds of miles.

What triggered this explosion of innovation? Language — but not just any language. Many animals can communicate. A green monkey can cry "Careful! A lion!" But only Sapiens can say, "The lion is the guardian spirit of our tribe."

This ability to speak about things that don't exist — fictions, myths, gods, nations, human rights, corporations — is the most unique feature of our language. You can never convince a chimpanzee to give you a banana by promising unlimited bananas in chimp heaven. But you can convince a human to do extraordinary things with the right story.

These shared fictions allowed strangers to cooperate in massive numbers. Two thousand chimpanzees in one place would be chaos. Two thousand humans who share a belief? That's a cathedral, an army, or a civilization.`,
  });

  stories.push({
    bookIndex: 1,
    title: 'The Agricultural Trap',
    readingTimeMinutes: 3, tone: 'provocative',
    categories: ['History', 'Science'],
    content: `What if the Agricultural Revolution — widely considered one of humanity's greatest achievements — was actually history's biggest fraud?

For millions of years, humans lived as foragers. They ate dozens of different foods, worked about three to six hours a day, and had rich social lives. Then, about 10,000 years ago, humans began cultivating wheat.

Farming demanded backbreaking labor — clearing fields, carrying water, pulling weeds. Human spines, knees, and necks weren't built for this work. Studies of ancient skeletons show a parade of slipped discs, arthritis, and hernias.

The diet narrowed dramatically. Instead of eating a varied menu of wild foods, farmers depended on a tiny number of crops. If the harvest failed, thousands starved.

Population density skyrocketed, bringing infectious diseases. Farmers lived in close quarters with animals, creating perfect conditions for epidemics.

So who benefited? Not individual humans. The real winner was wheat. From wheat's perspective, the Agricultural Revolution was a spectacular success. Ten thousand years ago, wheat was a wild grass in a small area of the Middle East. Today, it covers about 870,000 square miles of Earth. Wheat didn't domesticate us. We didn't domesticate wheat. Wheat domesticated Homo sapiens.`,
  });

  stories.push({
    bookIndex: 1,
    title: 'The Power of Shared Myths',
    readingTimeMinutes: 1, tone: 'philosophical',
    categories: ['History', 'Philosophy'],
    content: `Peugeot, the French car company, exists as a legal fiction. You can't point to it. You can't touch it. It's not the buildings — burn those down and Peugeot still exists. It's not the workers — fire them all and Peugeot persists. It's not the cars, the logo, or the CEO.

Peugeot exists because millions of people believe it exists. A clever lawyer performed certain rituals, wrote certain words on paper, and the collective imagination accepted a new entity into the world.

This is the secret of human civilization. We live inside shared fictions — money, nations, religions, corporations — and they're incredibly powerful precisely because we believe in them together. Pull the thread, and everything unravels. But as long as the myth holds, it can coordinate millions.`,
  });

  stories.push({
    bookIndex: 1,
    title: 'How Wheat Conquered the World',
    readingTimeMinutes: 10, tone: 'provocative',
    categories: ['History', 'Science', 'Philosophy'],
    content: `Ten thousand years ago, in the hills of southeastern Turkey, a wild grass quietly began one of the most successful takeovers in the history of life on Earth. That grass was wheat. And its strategy for world domination was breathtakingly simple: convince Homo sapiens to do all the work.

To understand how this happened, you need to forget everything you've been told about the Agricultural Revolution being "progress." The standard narrative goes like this: for millions of years, humans were primitive hunter-gatherers, wandering from place to place, constantly on the edge of starvation. Then, around 10,000 BC, some brilliant ancestors figured out they could plant seeds, settle down, and build civilization. Everything got better from there.

The truth is almost exactly the opposite.

Hunter-gatherers had it surprisingly good. Archaeological evidence suggests they worked about three to six hours per day to secure their food. They ate a remarkably varied diet — dozens of different plants, nuts, fruits, and animals. Their knowledge of the natural world was encyclopedic. A typical forager knew more about their environment than most modern humans know about their own neighborhoods.

They were also healthier than the farmers who came after them. Forager skeletons from this period show people who were tall, well-nourished, and relatively free of disease. They rarely experienced famine because they didn't depend on any single food source. If one river dried up, they moved to another.

Now here's where wheat enters the picture. Some clever foragers in the Fertile Crescent noticed that wild wheat grew particularly well in certain areas. They began returning to these spots, perhaps scattering extra seeds. Gradually, they spent more time near these wheat fields. They built permanent shelters. They started weeding. They carried water.

Each of these steps seemed rational. Why walk for three days to find food when there's a wheat field right here? Why live in a temporary camp when you can build something sturdy near your crop?

But each step also created a trap. Once you've cleared a field, built a house, dug irrigation channels, and stored grain, you can't just walk away. You're invested. And wheat, without lifting a finger, had just convinced a species of nomadic primates to become its full-time servants.

The consequences were devastating for individual humans. Farming was backbreaking work. Farmers bent over wheat fields for hours, carried heavy loads, and repeated the same motions until their joints failed. Archaeologists find a dramatic increase in slipped discs, arthritis, and hernias at the transition to agriculture.

The diet narrowed catastrophically. Instead of eating fifty different foods, farming communities depended on one or two crops. If the wheat harvest failed — drought, locusts, fungal infection — entire villages starved.

Then came disease. Dense farming settlements, living in close proximity to domesticated animals, became breeding grounds for epidemics. Measles, tuberculosis, smallpox — all jumped from animals to humans in early agricultural communities.

And there was a more insidious trap: population growth. Wheat produced more calories per acre, which meant more babies survived. More babies meant more mouths to feed, which meant more fields needed. Which meant more work. Nobody's life actually got easier.

This is a trap that should sound familiar. It's the same logic that keeps modern workers on a treadmill. You get a raise, so you upgrade your apartment. Now you need the raise just to pay rent. The economists call it the hedonic treadmill.

The numbers tell the story. In 10,000 BC, wheat was a wild grass limited to a small region of the Middle East. Today, wheat covers about 870,000 square miles of Earth's surface — roughly the size of Britain, France, Spain, and Germany combined.

During that same period, humans went from a few million foragers living varied, relatively healthy lives to billions of people, many working exhausting jobs, eating monotonous diets, and dying of diseases that didn't exist before agriculture.

From wheat's perspective, the Agricultural Revolution was an extraordinary success. A minor wild grass parlayed its relationship with one primate species into global domination.

The question isn't whether we can go back — we can't. The question is whether we can look at our own "wheat" — the technologies, careers, and systems that keep us busy but not better off — and ask honestly: who is really in control here?`,
  });

  // ── The Psychology of Money ───────────────────────────────────────────────

  stories.push({
    bookIndex: 2,
    title: 'The Janitor Who Died a Millionaire',
    readingTimeMinutes: 3, tone: 'inspiring',
    categories: ['Business', 'Psychology'],
    content: `Ronald Read was a gas station attendant for 25 years, then a janitor at JCPenney for 17 years. He bought a two-bedroom house for $12,000 and never left. He wore flannel shirts and a baseball cap. He chopped his own firewood well into his eighties.

When Read died in 2014 at the age of 92, his will shocked everyone. His estate was worth over $8 million. He left $2 million to his stepchildren and $6 million to the local hospital and library.

How does a janitor amass $8 million? There was no inheritance, no lottery ticket, no lucky stock pick. Read simply saved what he could and invested it in blue-chip stocks. Then he waited. For decades.

Around the same time Read died, Richard Fuscone — a Harvard-educated Merrill Lynch executive who had everything Read didn't — declared personal bankruptcy. Fuscone had earned millions, lived in a mansion, and was far more financially sophisticated.

Financial success is not about what you know. It's about how you behave. A janitor with patience and discipline can outperform an executive with an MBA but no self-control.

Wealth is what you don't see. It's the cars not purchased, the clothes not bought. Wealth is financial assets that haven't yet been converted into stuff. That's what Ronald Read understood.`,
  });

  stories.push({
    bookIndex: 2,
    title: 'Man in the Car Paradox',
    readingTimeMinutes: 1, tone: 'humorous',
    categories: ['Business', 'Psychology'],
    content: `When you see someone driving a nice car, you rarely think, "Wow, the person driving that car is cool." What you actually think is, "Wow, if I had that car, people would think I'm cool."

This is the paradox of wealth. You want a fancy car because you think it will earn you admiration and respect. But the people who see you driving it don't admire you — they're imagining themselves in the driver's seat.

The same goes for big houses, designer clothes, and expensive watches. No one is as impressed with your possessions as you think they are. They're too busy thinking about their own.`,
  });

  stories.push({
    bookIndex: 2,
    title: 'Luck and Risk Are Siblings',
    readingTimeMinutes: 3, tone: 'philosophical',
    categories: ['Business', 'Psychology'],
    content: `Bill Gates went to one of the only high schools in the world that had a computer in 1968. The odds of a teenager having access to a computer in the late 1960s were about one in a million.

Gates is brilliant and hardworking. But he also had an extraordinary stroke of luck — attending Lakeside School in Seattle, which happened to have a computer terminal connected to a mainframe. His classmate Paul Allen had the same luck.

Now consider Kent Evans. He was Gates' best friend at Lakeside and every bit as smart and driven. Evans was in the computer club too. He had the same access, the same talent, the same ambition. But Kent Evans never got to change the world — he died in a mountaineering accident before finishing high school.

Every outcome in life is guided by forces other than individual effort. Risk and luck are both the reality that every outcome is guided by forces beyond our control.

This doesn't diminish the importance of effort. It simply means that when judging others and yourself, you should be careful to acknowledge the role of circumstances you cannot control.`,
  });

  stories.push({
    bookIndex: 2,
    title: 'Enough',
    readingTimeMinutes: 1, tone: 'cautionary',
    categories: ['Business', 'Philosophy'],
    content: `At a party given by a billionaire on Shelter Island, Kurt Vonnegut told his friend Joseph Heller that their host, a hedge fund manager, had made more money in a single day than Heller had earned from his novel Catch-22 over its entire history.

Heller said, "Yes, but I have something he will never have — enough."

There is no reason to risk what you have and need for what you don't have and don't need. The hardest financial skill is getting the goalpost to stop moving. Modern capitalism makes us great at generating wealth and terrible at knowing when to stop.`,
  });

  // ── Thinking, Fast and Slow ───────────────────────────────────────────────

  stories.push({
    bookIndex: 3,
    title: 'The Bat and Ball Problem',
    readingTimeMinutes: 1, tone: 'educational',
    categories: ['Psychology', 'Science'],
    content: `A bat and a ball cost $1.10 in total. The bat costs $1.00 more than the ball. How much does the ball cost?

Most people immediately say "10 cents." It feels right. Your fast-thinking brain delivers the answer with total confidence. But it's wrong.

If the ball costs 10 cents, the bat costs $1.10, making the total $1.20.

The correct answer is 5 cents. But finding it requires engaging your slow, deliberate thinking system — which most people never bother to do because the wrong answer feels so satisfying.

This is how your mind works every day: confident, fast, and frequently wrong.`,
  });

  stories.push({
    bookIndex: 3,
    title: 'The Two Systems Inside Your Head',
    readingTimeMinutes: 3, tone: 'educational',
    categories: ['Psychology', 'Science'],
    content: `Picture a woman's face. She's angry. You don't need to think about whether she's angry — you just know. Instantly, effortlessly, automatically. That's System 1 at work.

Now try this: multiply 17 × 24. You probably know it's a multiplication problem. You might even know you could solve it. But the answer didn't come instantly. You'd need to concentrate, follow steps, maybe reach for a pen. That's System 2.

Daniel Kahneman spent his career studying these two systems. System 1 is fast, intuitive, emotional. It runs on autopilot. System 2 is slow, deliberate, logical. It requires effort.

Here's the problem: System 1 is always on, generating impressions and judgments effortlessly. System 2 is lazy. It would rather endorse System 1's snap judgments than do the hard work of actually thinking.

A famous experiment demonstrates this. People are told: A bat and a ball cost $1.10. The bat costs $1.00 more than the ball. How much does the ball cost?

Most people blurt out "10 cents." System 1 delivers the answer with confidence. But it's wrong. The correct answer is 5 cents. Finding it requires engaging System 2, which most people never bother to do.

This laziness isn't a flaw — it's a feature. We couldn't function if every decision required deep thought. But it means we make important choices based on impressions rather than analysis, far more often than we realize.`,
  });

  stories.push({
    bookIndex: 3,
    title: 'The Survivorship Bias of World War II',
    readingTimeMinutes: 5, tone: 'educational',
    categories: ['Psychology', 'Science', 'History'],
    content: `During World War II, a brilliant statistician named Abraham Wald was asked to solve a problem that seemed straightforward but had fooled every military strategist in the room.

The U.S. military wanted to add armor to their bombers to protect them from enemy fire. They studied the planes that returned from missions and mapped where the bullet holes were concentrated — mostly on the fuselage and wings. The logical conclusion seemed obvious: reinforce those areas.

Wald said the opposite. The military should armor the areas with no bullet holes — the engines, the cockpit, the tail.

The room went silent. Then the realization hit. The planes being studied were the survivors. The bombers that took hits to the engines, cockpit, or tail never made it back. The bullet holes on surviving planes showed where a bomber could take damage and still fly home. The missing holes revealed what was fatal.

This is survivorship bias — the dangerous tendency to focus on winners and draw conclusions while completely ignoring the failures that could teach you more.

The Halo Effect works similarly in everyday life. When a company succeeds, we study everything about it and attribute the success to its culture, leadership, or strategy. When it fails, we find flaws in the same things we praised.

Kahneman's research revealed that these biases aren't just common mistakes — they're the default operating mode of the human mind. System 1, our fast-thinking autopilot, constantly generates stories that make the world feel coherent. It suppresses ambiguity. It takes limited information and constructs a complete narrative, filling gaps with assumptions.

He called this "What You See Is All There Is" — WYSIATI. Your mind doesn't flag what it doesn't know. It works with whatever information is available and builds the best story it can. The result feels certain, even when it's built on sand.

The practical lesson is humbling: the more confident you feel about a decision, the more you should check whether you're falling for WYSIATI. What information are you missing? What bombers didn't come home?`,
  });

  // ── The Alchemist ─────────────────────────────────────────────────────────

  stories.push({
    bookIndex: 4,
    title: 'The Crystal Merchant Who Stopped Dreaming',
    readingTimeMinutes: 3, tone: 'dramatic',
    categories: ['Fiction', 'Philosophy'],
    content: `Santiago, a young shepherd from Andalusia, found himself working for a crystal merchant at the top of a steep hill in Tangier. The shop was dusty and forgotten, sitting far from the busy streets below.

"Why don't we build a display case and put it outside the shop?" Santiago suggested one morning. "We could attract people walking by."

The merchant resisted. He'd sold crystal from the same shop for thirty years. But something about Santiago's energy was hard to refuse, and eventually the merchant agreed.

Business picked up immediately. Santiago then suggested they sell tea in crystal glasses. Again, the merchant hesitated. Again, he relented. Within months, the shop was thriving.

But the crystal merchant never looked happy about his success. One evening, he told Santiago the truth.

"I don't want to grow any more," the merchant said quietly. "You know what my dream was? To make a pilgrimage to Mecca. Every Muslim is supposed to go at least once. When I started this shop, I told myself I'd save enough money to go. But as the money came in, I found excuses. If I went to Mecca, what would I have left to dream about?"

The merchant had discovered something terrifying: that having a dream sometimes feels better than living it. So he chose to remain at the top of his hill, selling crystal, dreaming of Mecca — forever.

Santiago understood the warning. Some people choose the comfort of their dreams over the risk of their reality. He packed his things the next morning and continued his journey…`,
  });

  stories.push({
    bookIndex: 4,
    title: 'The Englishman and the Alchemist',
    readingTimeMinutes: 3, tone: 'philosophical',
    categories: ['Fiction', 'Philosophy'],
    content: `At the oasis, Santiago met an Englishman who had spent years studying alchemy — reading every book, learning every formula, memorizing every symbol. He carried a trunk full of books across the Sahara.

When they finally found the Alchemist, the Englishman rushed forward with his notebooks. The Alchemist listened patiently, then said: "Go into the desert and observe the flowers."

The Englishman was furious. He'd spent a decade reading. He wanted formulas, not flowers. But he went.

Santiago asked what he should do. "Listen to your heart," the old man said simply. Santiago found this baffling but tried. He sat in the desert and listened.

Days passed. The Englishman returned frustrated — he'd seen flowers but learned nothing he could write down. Santiago returned transformed. He'd heard his heart speak of fear, of love, of the strange pull that had drawn him from his sheep to this oasis in the middle of nowhere.

The Alchemist smiled at Santiago and ignored the Englishman.

The lesson is uncomfortable for anyone who worships knowledge: wisdom isn't accumulated — it's experienced. The Englishman had more information than Santiago could ever dream of, but Santiago had something the books could never provide — the willingness to not know, to feel, to simply pay attention.`,
  });

  stories.push({
    bookIndex: 4,
    title: 'The Boy and the Spoon of Oil',
    readingTimeMinutes: 1, tone: 'philosophical',
    categories: ['Fiction', 'Philosophy'],
    content: `A boy traveled far to learn the secret of happiness from the wisest man in the world. When he arrived at the sage's palace, the wise man handed him a spoon with two drops of oil. "Walk around the palace," he said, "but don't spill the oil."

The boy walked carefully, eyes glued to the spoon. When he returned, the wise man asked, "Did you see the Persian tapestries? The garden? The parchments?"

The boy admitted he'd seen nothing — he'd been too focused on the oil. "Go again," said the sage, "and observe the marvels."

This time the boy noticed everything — but returned with an empty spoon.

"The secret of happiness," the sage said, "is to see all the marvels of the world, and never forget the drops of oil on the spoon."`,
  });

  // ── Deep Work ─────────────────────────────────────────────────────────────

  stories.push({
    bookIndex: 5,
    title: 'Carl Jung\'s Stone Tower',
    readingTimeMinutes: 3, tone: 'inspiring',
    categories: ['Self-Help', 'Business', 'Technology'],
    content: `In 1922, Carl Jung began building a stone tower on the shore of Lake Zurich in the village of Bollingen. It had no electricity and no phone. When Jung retreated there, he worked in a strict routine: writing, thinking, and carving stone.

This was not a vacation home. This was Jung's deep work sanctuary — the place where he produced some of the most influential ideas in the history of psychology.

At the time, Jung was locked in an intellectual battle with Sigmund Freud. The stakes were enormous: the future direction of psychotherapy. Jung needed to produce work of such quality and originality that it could stand on its own, separate from Freud's towering influence.

His answer was to go deep. Not just intellectually, but physically. He removed every possible distraction. No colleagues dropping by. No letters to answer. No small talk. Just Jung, his thoughts, and the stone walls he built with his own hands.

The Bollingen Tower produced Jung's most important works, including his theories on archetypes and the collective unconscious — ideas that shaped psychology, literature, and culture for a century.

Cal Newport argues that Jung's approach isn't just romantic history — it's a practical strategy. In a world drowning in shallow work (emails, meetings, Slack messages), the ability to go deep is becoming both rarer and more valuable. Those who cultivate it will thrive. Those who don't will be replaced by automation.

Deep work is not about working more hours. It's about working fewer hours with greater intensity and zero distractions.`,
  });

  stories.push({
    bookIndex: 5,
    title: 'The Four-Day Workweek Experiment',
    readingTimeMinutes: 1, tone: 'inspiring',
    categories: ['Business', 'Technology'],
    content: `In the early 2000s, a software company called 37signals (now Basecamp) tried something radical: they switched to a four-day workweek during summer months.

Productivity didn't drop. It increased. With less time, employees were forced to eliminate shallow work — the meetings that could have been emails, the emails that could have been nothing, the "quick chats" that consumed hours.

Constraints create focus. When you have unlimited time, you fill it with busywork. When time is scarce, you protect it fiercely. The four-day week didn't make people work less — it made them work better.`,
  });

  // ── Man's Search for Meaning ──────────────────────────────────────────────

  stories.push({
    bookIndex: 6,
    title: 'The Last Freedom',
    readingTimeMinutes: 3, tone: 'inspiring',
    categories: ['Philosophy', 'Psychology', 'Biography'],
    content: `Viktor Frankl was a psychiatrist in Vienna when the Nazis sent him to Auschwitz. He lost his wife, his parents, his brother, and his manuscript — the life's work he'd sewn into the lining of his coat, confiscated the moment he arrived.

In the camps, prisoners were stripped of everything that makes a person feel human. Names were replaced with numbers. Bodies were starved. Dignity was systematically destroyed.

But Frankl noticed something remarkable among the prisoners. Some, despite having nothing, maintained an inner strength that the guards could not touch. They shared their last piece of bread. They comforted others. One man walked through the barracks each evening, offering words of encouragement.

Frankl realized that while the Nazis could take everything external, they could not take a person's choice of how to respond. "Between stimulus and response there is a space," he later wrote. "In that space is our freedom and our power to grow."

This became the foundation of logotherapy — the idea that the primary human drive is not pleasure (as Freud believed) or power (as Adler believed), but meaning. Even in the most horrific circumstances, those who found purpose survived. Those who lost it perished — sometimes within days.

After liberation, Frankl wrote Man's Search for Meaning in just nine days. It has since sold over 16 million copies and been named one of the ten most influential books in America.

His central message: suffering is unavoidable, but suffering without meaning is unbearable. Find the why, and you can bear almost any how.`,
  });

  stories.push({
    bookIndex: 6,
    title: 'The Statue Inside the Marble',
    readingTimeMinutes: 1, tone: 'philosophical',
    categories: ['Philosophy', 'Psychology'],
    content: `Frankl was once asked how he maintained hope in Auschwitz. He described a technique he called "paradoxical intention" — but in the camps, it was simpler than that.

He imagined himself standing at a podium after the war, lecturing to a room full of students about the psychology of concentration camps. He pictured every detail: the wooden lectern, the attentive faces, the warm lights.

By mentally placing himself in the future, he gave his present suffering meaning. It wasn't just pain — it was research. It wasn't just survival — it was preparation.

The person who has a why to live can bear almost any how.`,
  });

  // ── The 48 Laws of Power ──────────────────────────────────────────────────

  stories.push({
    bookIndex: 7,
    title: 'Law 1: Never Outshine the Master',
    readingTimeMinutes: 3, tone: 'cautionary',
    categories: ['Business', 'History', 'Psychology'],
    content: `Nicolas Fouquet made one fatal mistake. As France's finance minister in the 1660s, he was wealthy, powerful, and — critically — eager to show it.

When young King Louis XIV visited, Fouquet threw a party at his château of Vaux-le-Vicomte that was the most lavish event France had ever seen. The food was prepared by the greatest chefs. The entertainment was composed by Molière. The gardens, designed by Le Nôtre, featured fountains that seemed to defy gravity. Fireworks lit the sky.

It was spectacular. It was also the worst decision of Fouquet's life.

Louis XIV, the Sun King, was 23 years old and already sensitive about his authority. Watching Fouquet's display of wealth and taste — wealth that could only have come from the royal treasury — the king was not impressed. He was humiliated.

Within three weeks, Fouquet was arrested. He spent the remaining 19 years of his life in prison, where he died. Louis seized his château, hired his architect, his garden designer, and his chef, and used them to build Versailles.

The lesson: always make those above you feel comfortably superior. In your desire to please or impress, do not go too far in displaying your talents or you might inspire fear and insecurity. Make your masters appear more brilliant than they are and you will attain the heights of power.`,
  });

  stories.push({
    bookIndex: 7,
    title: 'Law 15: Crush Your Enemy Totally',
    readingTimeMinutes: 1, tone: 'dramatic',
    categories: ['Business', 'History'],
    content: `In 280 BC, the Chinese state of Qin was rising. Its rivals formed an alliance to stop it. Rather than fight the alliance head-on, Qin's strategist Fan Sui convinced the king to adopt a devastating approach: befriend the distant states and attack the nearby ones.

One by one, Qin isolated and crushed each neighbor while the distant states watched, relieved they weren't next. By the time they realized the pattern, it was too late. Qin conquered them all and unified China under the first emperor.

The lesson is ruthless but clear: if you leave an ember burning, it will eventually reignite. If you must act against an enemy, do not stop halfway. Half-measures create enemies who spend the rest of their lives seeking revenge.`,
  });

  // ── Shoe Dog ──────────────────────────────────────────────────────────────

  stories.push({
    bookIndex: 8,
    title: 'The Crazy Idea',
    readingTimeMinutes: 3, tone: 'inspiring',
    categories: ['Biography', 'Business'],
    content: `In 1962, a 24-year-old named Phil Knight stood before his father and asked for a $50 loan. He had a "crazy idea" — as he called it — to import high-quality, low-cost running shoes from Japan and sell them in America.

Knight had written a paper about this at Stanford Business School. His professor had given it a good grade but hadn't been particularly enthusiastic. No one was enthusiastic. The entire American shoe market was dominated by Adidas and Puma, two German giants that seemed unmovable.

Knight flew to Japan anyway. He met with executives at Onitsuka Tiger (now ASICS) and convinced them to let him distribute their shoes on the West Coast. He didn't mention that his "company" — Blue Ribbon Sports — was just him, selling shoes out of the trunk of his green Plymouth Valiant at track meets.

For years, the business was on the edge of bankruptcy. Every dollar of profit was immediately reinvested in more inventory. Knight's bank threatened to cut him off repeatedly. He survived on the kindness of his former track coach, Bill Bowerman, who had become his partner and was obsessed with making lighter shoes — at one point pouring rubber into his wife's waffle iron to create a new sole design.

The waffle iron sole became Nike's first breakthrough. But the real breakthrough was Knight's refusal to quit. He spent over a decade broke, overworked, and terrified — building what would become a $30 billion company.

"The cowards never started," Knight wrote, "and the weak died along the way. That leaves us."`,
  });

  stories.push({
    bookIndex: 8,
    title: 'The Name',
    readingTimeMinutes: 1, tone: 'humorous',
    categories: ['Biography', 'Business'],
    content: `Phil Knight hated the name "Nike." When his employee Jeff Johnson suggested it — after the Greek goddess of victory — Knight wanted something better. He pushed for "Dimension Six." Everyone else thought that was terrible.

The deadline to submit the name to the factory arrived. Knight had nothing better. "I guess we'll go with Nike," he said reluctantly. "I don't love it. But maybe it will grow on me."

The Swoosh logo cost $35, designed by a Portland State graphic design student named Carolyn Davidson. Knight told her, "I don't love it, but maybe it will grow on me."

It did. Both the name and the logo became two of the most recognizable brands in human history. Sometimes the best decisions are the ones you make when time runs out and your back is against the wall.`,
  });

  // ── The Power of Now ──────────────────────────────────────────────────────

  stories.push({
    bookIndex: 9,
    title: 'The Beggar on the Box',
    readingTimeMinutes: 1, tone: 'philosophical',
    categories: ['Spirituality', 'Philosophy', 'Self-Help'],
    content: `A beggar had been sitting by the side of the road for over thirty years. One day a stranger walked by. "Spare some change?" mumbled the beggar.

"I have nothing to give you," said the stranger. Then he asked, "What's that you're sitting on?"

"Nothing," said the beggar. "Just an old box. I've been sitting on it for as long as I can remember."

"Ever look inside?" asked the stranger.

"No," said the beggar. "What's the point? There's nothing in there."

"Have a look inside," the stranger insisted. The beggar pried open the lid. With astonishment, disbelief, and elation, he saw that the box was filled with gold.

Tolle uses this parable to illustrate his central teaching: you are already sitting on the treasure. The peace and fulfillment you seek are not somewhere else, in the future, in another relationship, in a better job. They are here. Now. You've just never looked.`,
  });

  stories.push({
    bookIndex: 9,
    title: 'The Duck With a Human Mind',
    readingTimeMinutes: 1, tone: 'humorous',
    categories: ['Spirituality', 'Philosophy'],
    content: `Two ducks get into a fight. It's brief and intense. Afterward, they separate and float off in opposite directions. Then each duck flaps its wings vigorously a few times — releasing the built-up energy. After that, they glide peacefully on the water as if nothing happened.

Now imagine if ducks had human minds. The first duck would float away thinking: "I can't believe he did that. Who does he think he is? He has no right to come into my space like that. I'll never trust him again. I wonder if the other ducks noticed..."

And the story would continue. For hours. For days. For the rest of the duck's life, perhaps.

This is what Tolle means by the "pain body" — the accumulated residue of emotional pain that lives in the mind and feeds on drama, conflict, and suffering. Unlike ducks, humans don't release their fights. They replay them endlessly.

The way out isn't through thinking harder. It's through observing your thoughts without becoming them.`,
  });

  return stories;
}

async function seed() {
  console.log('\n=== BookBite Database Seed ===\n');

  // Clear existing data
  console.log('Clearing existing data...');
  await prisma.dailyFeed.deleteMany();
  await prisma.storyView.deleteMany();
  await prisma.like.deleteMany();
  await prisma.bookmark.deleteMany();
  await prisma.story.deleteMany();
  await prisma.book.deleteMany();
  await prisma.userPreference.deleteMany();
  await prisma.user.deleteMany();

  // ── Create test user ──────────────────────────────────────────────────
  console.log('Creating test user (test@test.com)...');
  const testPassword = await bcrypt.hash('test', 12);
  const testUser = await prisma.user.create({
    data: {
      email: 'test@test.com',
      passwordHash: testPassword,
      displayName: 'Test User',
      role: 'USER',
      preferences: {
        create: {
          bookCategories: ['Self-Help', 'Psychology', 'Business', 'Philosophy'],
          preferredReadingTimes: [1, 3, 5],
          onboardingCompleted: true,
        },
      },
    },
  });
  console.log(`  User: ${testUser.email} / password: test`);

  // ── Create admin user ─────────────────────────────────────────────────
  console.log('Creating admin user...');
  const adminPassword = await bcrypt.hash('admin', 12);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@bookbite.app',
      passwordHash: adminPassword,
      displayName: 'Admin',
      role: 'ADMIN',
      preferences: {
        create: {
          bookCategories: ['Self-Help', 'Business', 'Biography', 'Psychology', 'Science', 'Philosophy', 'History', 'Fiction'],
          preferredReadingTimes: [1, 3, 5, 10],
          onboardingCompleted: true,
        },
      },
    },
  });
  console.log(`  Admin: ${admin.email} / password: admin`);

  // ── Create books ──────────────────────────────────────────────────────
  console.log('Creating books...');
  const books = [];
  for (const bookData of SAMPLE_BOOKS) {
    const book = await prisma.book.create({
      data: { ...bookData, status: 'COMPLETED', tier: 1 }, // Curated top books
    });
    books.push(book);
    console.log(`  Book: ${book.title} by ${book.author} (tier 1)`);
  }

  // ── Create stories ────────────────────────────────────────────────────
  console.log('Creating stories...');
  const allStories = buildStories();
  let storyCount = 0;

  for (const storyData of allStories) {
    const { bookIndex, storyGroupId, ...data } = storyData;
    await prisma.story.create({
      data: {
        ...data,
        bookId: books[bookIndex].id,
        storyGroupId: storyGroupId || uuid(),
      },
    });
    storyCount++;
  }
  console.log(`  Created ${storyCount} stories`);

  // ── Update book story counts ──────────────────────────────────────────
  for (const book of books) {
    const count = await prisma.story.count({ where: { bookId: book.id } });
    await prisma.book.update({
      where: { id: book.id },
      data: { storyCount: count },
    });
  }

  // ── Simulate some activity for the test user ──────────────────────────
  console.log('Simulating user activity...');
  const stories = await prisma.story.findMany({ take: 20 });

  // Like some stories
  let likedCount = 0;
  for (let i = 0; i < Math.min(8, stories.length); i++) {
    await prisma.like.create({
      data: { userId: testUser.id, storyId: stories[i].id },
    });
    await prisma.story.update({
      where: { id: stories[i].id },
      data: { likeCount: { increment: 1 } },
    });
    likedCount++;
  }
  console.log(`  Liked ${likedCount} stories`);

  // Bookmark some stories
  let bookmarkedCount = 0;
  for (let i = 0; i < Math.min(5, stories.length); i++) {
    await prisma.bookmark.create({
      data: { userId: testUser.id, storyId: stories[i].id },
    });
    await prisma.story.update({
      where: { id: stories[i].id },
      data: { bookmarkCount: { increment: 1 } },
    });
    bookmarkedCount++;
  }
  console.log(`  Bookmarked ${bookmarkedCount} stories`);

  // Note: we intentionally do NOT create StoryView records during seeding.
  // Views are tracked organically when the user scrolls through the feed.
  // Pre-creating views would cause the daily feed builder to exclude
  // those stories, resulting in a smaller/empty feed.
  const viewedCount = 0;
  console.log(`  Viewed ${viewedCount} stories (none pre-seeded — tracked organically)`);

  // ── Build daily feeds ────────────────────────────────────────────────
  console.log('Building daily feeds...');
  const feedResult = await dailyFeedBuilder.buildForAllUsers();
  console.log(`  Feeds built: ${feedResult.built}`);

  // ── Summary ───────────────────────────────────────────────────────────
  console.log('\n=== Seed Complete ===');
  console.log(`  Test user:  test@test.com / test`);
  console.log(`  Admin:      admin@bookbite.app / admin`);
  console.log(`  Books:      ${books.length}`);
  console.log(`  Stories:    ${storyCount}`);
  console.log(`  Likes:      ${likedCount}`);
  console.log(`  Bookmarks:  ${bookmarkedCount}`);
  console.log(`  Views:      ${viewedCount}`);
  console.log(`  Daily feeds: ${feedResult.built}\n`);

  await prisma.$disconnect();
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
