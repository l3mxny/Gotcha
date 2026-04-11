import cv2

video = cv2.VideoCapture("IMG_7612.MP4")  # change to your filename
count = 0

while True:
    ret, frame = video.read()
    if not ret:
        break
    if count % 10 == 0:  # every 10 frames
        cv2.imwrite(f"frame_{count}.jpg", frame)
    count += 1

video.release()
print("Done!")