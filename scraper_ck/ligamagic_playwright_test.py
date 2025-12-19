from playwright.sync_api import sync_playwright
from dataclasses import dataclass

# Exemplo com Avatar: The Last Airbender Eternal
URL = "https://www.ligamagic.com.br/?view=cards/search&card=edid=480850%20ed=tle"


@dataclass
class CardInfo:
    name: str
    price_min: float


def parse_price_brl(raw: str) -> float:
    raw = raw.strip()
    raw = raw.replace("R$", "").replace(" ", "")
    raw = raw.replace(".", "")
    raw = raw.replace(",", ".")
    if not raw:
        return 0.0
    return float(raw)


def scrape_ligamagic_list_view_en(url: str) -> tuple[str, list[CardInfo]]:
    with sync_playwright() as p:
        # Deixe headless=False enquanto estiver testando
        browser = p.chromium.launch(headless=False, slow_mo=400)
        page = browser.new_page()

        print("Abrindo página...")
        page.goto(url, wait_until="networkidle")
        print("URL carregada:", page.url)
        print("Título da página:", page.title())

        # 0) Garantir que o conteúdo inicial carregou (galeria)
        try:
            page.wait_for_selector("div.grid-cardsinput", timeout=10000)
            print("grid-cardsinput encontrado (modo galeria).")
        except Exception as e:
            print("Nao encontrei grid-cardsinput:", e)

        # 1) Trocar visualização para LISTA primeiro
        # <div class="tb-show">
        #   <img class="tb-view-02" onclick="edc.changeView(2);">
        # </div>
        try:
            btn_list = page.locator('div.tb-show img.tb-view-02[onclick*="edc.changeView(2)"]')
            btn_list.wait_for(state="visible", timeout=10000)
            print("Botão de exibição em lista encontrado. Clicando...")
            btn_list.click()
        except Exception as e:
            print("Falha ao encontrar/clicar no botão de lista:", e)
            page.screenshot(path="ligamagic_sem_botao_lista.png", full_page=True)
            browser.close()
            raise

        # 2) Esperar a tabela aparecer (ainda em português, mas já em modo lista)
        print("Esperando a tabela (div.card-table) aparecer...")
        try:
            page.wait_for_selector("div.card-table table tbody tr", timeout=20000)
            print("Tabela encontrada em modo lista.")
        except Exception as e:
            print("Nao encontrei a tabela:", e)
            page.screenshot(path="ligamagic_sem_tabela.png", full_page=True)
            browser.close()
            raise

        # 3) Agora sim: trocar idioma para inglês
        # Essa div só aparece em modo lista:
        # <div class="tb-ed-language-changer">
        #   <span class="ed-language-changer-en" onclick="edc.reloadLanguage('nEN');">Alterar idioma para inglês</span>
        #   ...
        # </div>
        try:
            lang_btn = page.locator("span.ed-language-changer-en")
            lang_btn.wait_for(state="visible", timeout=10000)
            print("Botão de idioma EN encontrado. Clicando...")
            lang_btn.click()

            # Espera recarregar o conteúdo em inglês (tabela pode ser recarregada)
            page.wait_for_load_state("networkidle")
            page.wait_for_selector("div.card-table table tbody tr", timeout=20000)
            print("Idioma alterado para inglês (tabela recarregada).")
        except Exception as e:
            print("Falha ao trocar idioma para inglês (talvez já esteja em EN):", e)

        # Screenshot para conferir visualmente se está em inglês e em lista
        page.screenshot(path="ligamagic_tabela_en.png", full_page=True)
        print("Screenshot salva como ligamagic_tabela_en.png")

        # 4) Título da coleção
        collection_title = page.text_content("div.tb-ed b") or ""
        collection_title = collection_title.strip() or "Sem título"

        # 5) Linhas da tabela (agora, em tese, com nomes em inglês)
        rows = page.query_selector_all("div.card-table table tbody tr")
        print("Qtd linhas na tabela:", len(rows))

        cards: list[CardInfo] = []

        for row in rows:
            tds = row.query_selector_all("td")
            if len(tds) < 7:
                continue

            # 2ª coluna = nome da carta (em inglês)
            name_el = tds[1]
            # 7ª coluna = preço mínimo
            price_el = tds[6]

            name = (name_el.inner_text() or "").strip()
            raw_price = (price_el.inner_text() or "").strip()

            if not name:
                continue

            try:
                price_min = parse_price_brl(raw_price)
            except ValueError:
                continue

            cards.append(CardInfo(name=name, price_min=price_min))

        browser.close()
        return collection_title, cards


if __name__ == "__main__":
    title, cards = scrape_ligamagic_list_view_en(URL)

    print("Coleção:", title)
    print("Total de cartas:", len(cards))
    print("-" * 40)
    for c in cards[:20]:
        print(f"{c.name}  |  R$ {c.price_min:.2f}")
