#!/usr/bin/env python3
"""
MyCase Web Scraper for Legal Advocate AI
Logs into Utah Courts MyCase portal and extracts case information
"""

import os
import json
import time
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

# Load environment variables
load_dotenv()

class MyCaseScraper:
    def __init__(self, headless=False):
        self.email = os.getenv('MYCASE_EMAIL')
        self.password = os.getenv('MYCASE_PASSWORD')
        self.url = os.getenv('MYCASE_URL')
        self.headless = headless
        self.data_dir = Path('scraped_data')
        self.data_dir.mkdir(exist_ok=True)

        if not all([self.email, self.password, self.url]):
            raise ValueError("Missing credentials in .env file")

    def scrape(self):
        """Main scraping workflow"""
        print("🔍 Starting MyCase scraper...")
        print(f"📧 Email: {self.email}")
        print(f"🌐 URL: {self.url}")

        with sync_playwright() as p:
            # Launch browser
            browser = p.chromium.launch(headless=self.headless)
            context = browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            )
            page = context.new_page()

            try:
                # Step 1: Navigate and login
                print("\n🔐 Logging in...")
                case_data = self._login_and_extract(page)

                # Step 2: Save raw data
                self._save_data(case_data)

                # Step 3: Generate summary
                self._print_summary(case_data)

                print("\n✅ Scraping complete!")
                return case_data

            except Exception as e:
                print(f"\n❌ Error during scraping: {e}")
                # Take screenshot for debugging
                screenshot_path = self.data_dir / f'error_{datetime.now().strftime("%Y%m%d_%H%M%S")}.png'
                page.screenshot(path=str(screenshot_path))
                print(f"📸 Error screenshot saved: {screenshot_path}")
                raise
            finally:
                browser.close()

    def _login_and_extract(self, page):
        """Login and extract case information"""
        # Navigate to login page
        print(f"   → Navigating to {self.url}")
        try:
            page.goto(self.url, wait_until='domcontentloaded', timeout=60000)
        except Exception as e:
            print(f"   ⚠️  Navigation timeout, continuing anyway: {e}")

        # Take initial screenshot
        try:
            page.screenshot(path=str(self.data_dir / '01_initial_page.png'))
            print("   → Screenshot: 01_initial_page.png")
        except:
            pass

        # Wait a moment for page to fully load
        time.sleep(3)

        # Look for login form fields
        print("   → Looking for login form...")

        # Try common login field selectors
        email_selectors = [
            'input[type="email"]',
            'input[name*="email" i]',
            'input[name*="username" i]',
            'input[name*="user" i]',
            'input[id*="email" i]',
            'input[id*="username" i]',
            '#username',
            '#email',
            'input[type="text"]'
        ]

        password_selectors = [
            'input[type="password"]',
            'input[name*="password" i]',
            'input[id*="password" i]',
            '#password'
        ]

        # Find email/username field
        email_field = None
        for selector in email_selectors:
            try:
                if page.query_selector(selector):
                    email_field = selector
                    print(f"   ✓ Found email field: {selector}")
                    break
            except:
                continue

        # Find password field
        password_field = None
        for selector in password_selectors:
            try:
                if page.query_selector(selector):
                    password_field = selector
                    print(f"   ✓ Found password field: {selector}")
                    break
            except:
                continue

        if not email_field or not password_field:
            # Save page HTML for debugging
            html_path = self.data_dir / 'page_source.html'
            with open(html_path, 'w', encoding='utf-8') as f:
                f.write(page.content())
            print(f"   ⚠️  Could not find login fields. Page HTML saved to: {html_path}")

            # Try to find all input fields
            all_inputs = page.query_selector_all('input')
            print(f"   📋 Found {len(all_inputs)} input fields:")
            for idx, inp in enumerate(all_inputs):
                try:
                    input_type = inp.get_attribute('type') or 'unknown'
                    input_name = inp.get_attribute('name') or 'unknown'
                    input_id = inp.get_attribute('id') or 'unknown'
                    print(f"      {idx}: type={input_type}, name={input_name}, id={input_id}")
                except:
                    pass

        # Fill login form
        if email_field and password_field:
            print("   → Filling login credentials...")
            try:
                page.fill(email_field, self.email, timeout=60000)
                page.fill(password_field, self.password, timeout=60000)
            except Exception as e:
                print(f"   ⚠️  Error filling fields: {e}")
                # Try typing instead
                page.locator(email_field).type(self.email)
                page.locator(password_field).type(self.password)

            try:
                page.screenshot(path=str(self.data_dir / '02_credentials_filled.png'))
                print("   → Screenshot: 02_credentials_filled.png")
            except:
                pass

            # Find and click submit button
            submit_selectors = [
                'button[type="submit"]',
                'input[type="submit"]',
                'button:has-text("Login")',
                'button:has-text("Sign In")',
                'button:has-text("Log In")',
                'input[value*="Login" i]',
                'input[value*="Sign In" i]'
            ]

            for selector in submit_selectors:
                try:
                    if page.query_selector(selector):
                        print(f"   → Clicking submit button: {selector}")
                        page.click(selector)
                        break
                except:
                    continue

            # Wait for navigation
            try:
                page.wait_for_load_state('networkidle', timeout=10000)
            except:
                print("   ⚠️  Page did not reach networkidle state")

            time.sleep(2)
            page.screenshot(path=str(self.data_dir / '03_after_login.png'))
            print("   → Screenshot: 03_after_login.png")

        # Extract case data from current page
        print("\n📊 Extracting case information...")
        case_data = self._extract_case_data(page)

        return case_data

    def _extract_case_data(self, page):
        """Extract all case information from the page"""
        data = {
            'scraped_at': datetime.now().isoformat(),
            'url': page.url,
            'title': page.title(),
            'case_info': {},
            'parties': [],
            'events': [],
            'documents': [],
            'raw_text': None
        }

        # Get full page text
        data['raw_text'] = page.inner_text('body')

        # Save full HTML
        html_path = self.data_dir / 'case_page.html'
        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(page.content())
        print(f"   ✓ Saved HTML: {html_path}")

        # Try to extract structured data
        # Look for tables (common in court systems)
        tables = page.query_selector_all('table')
        print(f"   → Found {len(tables)} tables")

        for idx, table in enumerate(tables):
            try:
                rows = table.query_selector_all('tr')
                table_data = []
                for row in rows:
                    cells = row.query_selector_all('td, th')
                    if cells:
                        row_data = [cell.inner_text().strip() for cell in cells]
                        table_data.append(row_data)

                if table_data:
                    data[f'table_{idx}'] = table_data
                    print(f"   ✓ Extracted table {idx}: {len(table_data)} rows")
            except Exception as e:
                print(f"   ⚠️  Error extracting table {idx}: {e}")

        # Look for case number patterns
        import re
        case_pattern = r'\b\d{6,}-[A-Z]{2,}\b|\b[A-Z]{2,}\d{6,}\b'
        case_matches = re.findall(case_pattern, data['raw_text'])
        if case_matches:
            data['case_info']['possible_case_numbers'] = list(set(case_matches))
            print(f"   ✓ Found possible case numbers: {case_matches}")

        # Look for dates
        date_pattern = r'\b\d{1,2}/\d{1,2}/\d{2,4}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}\b'
        date_matches = re.findall(date_pattern, data['raw_text'])
        if date_matches:
            data['events_dates'] = list(set(date_matches))[:20]  # Limit to 20
            print(f"   ✓ Found {len(date_matches)} dates")

        return data

    def _save_data(self, data):
        """Save scraped data to JSON file"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        json_path = self.data_dir / f'mycase_data_{timestamp}.json'

        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        print(f"\n💾 Data saved: {json_path}")

    def _print_summary(self, data):
        """Print summary of scraped data"""
        print("\n" + "="*70)
        print("📋 SCRAPING SUMMARY")
        print("="*70)
        print(f"URL: {data['url']}")
        print(f"Page Title: {data['title']}")
        print(f"Scraped At: {data['scraped_at']}")

        if data['case_info'].get('possible_case_numbers'):
            print(f"\n📁 Possible Case Numbers:")
            for num in data['case_info']['possible_case_numbers']:
                print(f"   • {num}")

        if data.get('events_dates'):
            print(f"\n📅 Found {len(data['events_dates'])} dates")

        # Count tables
        table_count = sum(1 for key in data.keys() if key.startswith('table_'))
        if table_count > 0:
            print(f"\n📊 Extracted {table_count} tables")

        print(f"\n📝 Total text length: {len(data.get('raw_text', ''))} characters")
        print("="*70)


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description='Scrape MyCase court data')
    parser.add_argument('--headless', action='store_true', help='Run in headless mode')
    parser.add_argument('--visible', action='store_true', help='Run with visible browser (default)')

    args = parser.parse_args()

    # Default to visible browser for debugging
    headless = args.headless if args.headless or args.visible else False

    scraper = MyCaseScraper(headless=headless)
    scraper.scrape()


if __name__ == '__main__':
    main()
