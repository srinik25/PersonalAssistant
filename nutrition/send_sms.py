import smtplib
from email.mime.text import MIMEText

GMAIL_USER = "srinikatta24@gmail.com"
APP_PASSWORD = ""  # set your Gmail app password here

SITE_URL = "https://wintry-tower-54cj.here.now"

SMS_RECIPIENTS = [
    "7038192545@tmomail.net",
    "7039896189@tmomail.net",
]
EMAIL_FALLBACK = ["srini.katta@ymail.com", "arathi_dommeti@yahoo.com"]

message_body = f"Nutrition Profiles: {SITE_URL}/"


def send(body=message_body):
    failed = []
    with smtplib.SMTP("smtp.gmail.com", 587) as server:
        server.starttls()
        server.login(GMAIL_USER, APP_PASSWORD)
        for recipient in SMS_RECIPIENTS:
            try:
                msg = MIMEText(body)
                msg["From"] = GMAIL_USER
                msg["To"] = recipient
                msg["Subject"] = "Nutrition Profiles"
                server.sendmail(GMAIL_USER, recipient, msg.as_string())
                print(f"SMS sent to {recipient}")
            except Exception as e:
                print(f"SMS failed for {recipient}: {e}")
                failed.append(recipient)

        # Fallback to email if any SMS failed
        if failed:
            print("Falling back to email...")
            for recipient in EMAIL_FALLBACK:
                msg = MIMEText(body)
                msg["From"] = GMAIL_USER
                msg["To"] = recipient
                msg["Subject"] = "Nutrition Profiles"
                server.sendmail(GMAIL_USER, recipient, msg.as_string())
                print(f"Email sent to {recipient}")

    print("Done!")


if __name__ == "__main__":
    send()
