# Village Strong and FAMILY Foundation Architecture

```mermaid
flowchart TD
    Foundation["Village Strong and FAMILY Foundation"]

    Foundation --> Website["villagestrongfoundation.org"]
    Website --> Home["Foundation Home<br/>/"]
    Website --> Family["FAMILY Program<br/>/family"]
    Website --> Village["Village Strong Program<br/>/village-strong"]

    Family --> Fatherhood["Fatherhood Science"]
    Fatherhood --> Identity["Father identity and development"]
    Fatherhood --> Parenting["Parenting knowledge and skills"]
    Fatherhood --> Stability["Family stability and engagement"]

    Village --> Childhood["Childhood Science<br/>Birth through age 18"]
    Childhood --> Early["Early Childhood<br/>Birth–5"]
    Childhood --> Middle["Middle Childhood<br/>Ages 6–11"]
    Childhood --> Adolescent["Adolescence<br/>Ages 12–18"]

    Website --> Platform["Cloudflare Worker Platform"]
    Platform --> Database["Cloudflare D1"]
    Platform --> Images["Cloudflare Images"]
```

## Program Distinction

| Route | Program | Specialization |
|-------|---------|---|
| `/family` | FAMILY | Fatherhood Science |
| `/village-strong` | Village Strong | Childhood Science, birth through age 18 |
| `/` | Foundation | Shared organizational entry point |
