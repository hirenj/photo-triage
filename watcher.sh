#!/bin/sh

TARGET_DIR="/volume1/photo/Photos"
SOURCE_DIR="/volume1/common.photo.edited"
RAWS_DIR="/volume1/common.photo.raw"

OLDIFS=$IFS
IFS=$'\n'

EXISTING_SYMLINKS=$(find "$TARGET_DIR" -type l)
RATINGS_FILES=$(find "$SOURCE_DIR" -name '*.json')

WANTED_SYMLINKS=$(for rating in $RATINGS_FILES; do
	parent_dir=$(dirname "$rating")
	parent_dir="${parent_dir//\'/\\'}"
	filenames=$(cat "$rating" | python -c "import sys, json; print '\n'.join( map(lambda x: '$parent_dir/'+x['fname'] , filter(lambda x: x['rating'] > 0 , json.load(sys.stdin) ) ))")
	echo -e "$filenames"
done)

for symlink in $WANTED_SYMLINKS; do
	filename="$(basename "$symlink")"
	folder_name="$(basename "$(dirname "$symlink")")"
	rawfile="${filename%.*}"
	rawfiles=$(find $RAWS_DIR -name "${rawfile}.RW2")
	targetdir="$(dirname "$symlink")"
	if [ ! -h "$TARGET_DIR/$folder_name/$filename" ] && [ -f "$symlink" ]; then
		echo "Symlinking from $symlink to $TARGET_DIR/$folder_name/$filename"
		mkdir -p "$TARGET_DIR/$folder_name"
		ln -s "$symlink" "$TARGET_DIR/$folder_name/$filename"
		for raw in "$rawfiles"; do
			rawfilename="$(basename "$raw")"
			if [ -f "$raw" ] && [ ! -f "$targetdir/$rawfilename" ]; then
				cp "$raw" "$targetdir"
			fi
		done
	fi
done

CURRENT_SYMLINKS=$(for symlink in $WANTED_SYMLINKS; do
	filename=$(basename "$symlink")
	folder_name="$(basename "$(dirname "$symlink")")"
	echo -e "$TARGET_DIR/$folder_name/$filename"
done)

OLD_SYMLINKS=$(for i in $EXISTING_SYMLINKS; do
     skip=
     for j in $CURRENT_SYMLINKS; do
         [[ $i == $j ]] && { skip=1; break; }
     done

     if [ "$skip" != "1" ]; then
     	echo "$i"
     fi
done)

for symlink in $OLD_SYMLINKS; do
	filename=$(basename "$symlink")
	if [ -h "$symlink" ]; then
		echo "Removing symlink $symlink"
		rm "$symlink"
	fi
done

synoindex -R photo

IFS=$OLDIFS