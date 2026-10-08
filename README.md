# Rozjezd

Denní plán, řetěz dnů, časovač soustředění a karta „Další krok", která ukáže jeden malý krok na 10 minut. Webová appka (PWA) pro telefon i počítač, bez instalace z obchodu.

Obsah složky: `index.html`, `app.js`, `config.js`, `sw.js`, `manifest.webmanifest`, `icons/`.

## 1. Vyzkoušet lokálně

Ve složce spusť:

```bash
python -m http.server 8080
```

Pak otevři http://localhost:8080. Bez dalšího nastavení appka ukládá jen do zařízení (záloha jde stáhnout v Nastavení).

## 2. Zapnout synchronizaci (Firebase, zdarma)

Synchronizaci zapíná majitel projektu, tedy ten, kdo appku nasazuje.

1. Jdi na https://console.firebase.google.com a přihlas se svým Google účtem.
2. **Add project**, pojmenuj třeba `rozjezd`, Google Analytics vypni.
3. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable**.
4. **Build → Firestore Database → Create database**, režim **production**, lokalita například `eur3 (europe-west)`.
5. V záložce **Rules** nahraď obsah tímto a dej **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

6. **Project settings (ozubené kolo) → Your apps → Web (`</>`) → Register app**. Zkopíruj objekt `firebaseConfig`.
7. V souboru `config.js` nahraď `null` takto:

```js
window.ROZJEZD_FIREBASE = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  appId: "..."
};
```

Tyhle hodnoty nejsou tajné. Přístup hlídají pravidla výše, takže každý uživatel vidí jen svá data.

8. Až appku nasadíš, přidej její doménu v **Authentication → Settings → Authorized domains** (například `tvoje-jmeno.github.io`).

## 3. Nasadit na GitHub Pages (zdarma)

1. Na GitHubu vytvoř nový repozitář, například `rozjezd`.
2. Nahraj do něj obsah téhle složky (ne celé ROVA_CARS).
3. **Settings → Pages → Deploy from a branch → main / (root)**.
4. Za minutu appka běží na `https://tvoje-jmeno.github.io/rozjezd/`.

Po každé změně souborů zvyš v `sw.js` hodnotu `V` (například `rozjezd-v2`), ať se u uživatelů obnoví cache.

## 4. Přidat na plochu

- **iPhone:** otevři adresu v Safari, **Sdílet → Přidat na plochu**.
- **Mac:** v Safari **Sdílet → Přidat do Docku**, v Chromu **Nainstalovat**.
- Pak se přihlas stejným e-mailem a heslem na obou zařízeních (Nastavení → Synchronizace).

## Soukromí

Data každé uživatelky jsou uložená ve tvém Firebase projektu. Jako správce je můžeš vidět v konzoli Firebase. Řekni to kamarádce, než si vytvoří účet.
