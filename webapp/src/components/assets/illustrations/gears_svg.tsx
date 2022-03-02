// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import Svg from '../svg';

const Gears = (props: {className?: string}) => (
    <Svg
        width='74'
        height='69'
        viewBox='0 0 74 69'
        fill='none'
    >
        <path
            d='M8.79783 18.5235C8.99227 18.507 9.18785 18.5366 9.36872 18.6097C9.54959 18.6829 9.71067 18.7976 9.83894 18.9445C9.96722 19.0914 10.0591 19.2664 10.1071 19.4554C10.1551 19.6444 10.1579 19.842 10.1152 20.0323L9.31987 26.3531C9.31392 26.5476 9.26225 26.7379 9.16914 26.9089C9.07604 27.0798 8.94405 27.2264 8.7838 27.337C8.62356 27.4475 8.4396 27.5189 8.24667 27.5454C8.05374 27.5719 7.85727 27.5527 7.67313 27.4894L1.75735 25.6701C1.35477 25.5183 1.01414 25.2371 0.789132 24.8706C0.564127 24.5041 0.467532 24.0733 0.514537 23.6459L0.912245 20.4793C0.972425 20.0521 1.17403 19.6574 1.48487 19.3581C1.79572 19.0588 2.1979 18.872 2.62733 18.8277L8.79783 18.5235Z'
            fill='#63697E'
        />
        <path
            d='M8.83527 31.7051C8.96124 31.557 9.12021 31.4406 9.29943 31.3651C9.47864 31.2896 9.6731 31.2572 9.86713 31.2705C10.0612 31.2838 10.2493 31.3424 10.4165 31.4416C10.5838 31.5408 10.7254 31.6778 10.83 31.8417L14.7448 36.871C14.8785 37.0127 14.977 37.1839 15.0322 37.3707C15.0875 37.5575 15.098 37.7547 15.0629 37.9463C15.0278 38.1379 14.9481 38.3185 14.8302 38.4736C14.7124 38.6288 14.5596 38.754 14.3844 38.8393L8.90983 41.7327C8.51811 41.9144 8.0766 41.9594 7.65625 41.8603C7.23591 41.7612 6.86113 41.5238 6.59201 41.1863L4.63457 38.6717C4.37516 38.3273 4.23853 37.9061 4.24642 37.4751C4.2543 37.0442 4.4062 36.6282 4.67803 36.2936L8.83527 31.7051Z'
            fill='#63697E'
        />
        <path
            d='M18.2183 41.0002C18.2019 40.8059 18.2315 40.6105 18.3047 40.4297C18.3779 40.249 18.4926 40.0881 18.6397 39.9599C18.7867 39.8317 18.9619 39.7399 19.151 39.6919C19.3401 39.644 19.5379 39.6412 19.7283 39.6838L26.0542 40.4786C26.2488 40.4845 26.4394 40.5361 26.6104 40.6291C26.7815 40.7221 26.9282 40.8541 27.0389 41.0142C27.1495 41.1743 27.221 41.3581 27.2475 41.5509C27.2739 41.7437 27.2547 41.94 27.1913 42.124L25.3707 48.0412C25.2197 48.4441 24.9384 48.7851 24.5714 49.0101C24.2044 49.235 23.7727 49.3311 23.3449 49.283L20.1757 48.8856C19.7482 48.8255 19.3532 48.6241 19.0536 48.3135C18.754 48.0029 18.5671 47.6011 18.5228 47.172L18.2183 41.0002Z'
            fill='#63697E'
        />
        <path
            d='M31.3795 40.969C31.2301 40.8433 31.1125 40.684 31.0362 40.5043C30.9599 40.3246 30.9271 40.1295 30.9404 39.9347C30.9537 39.74 31.0128 39.5511 31.1128 39.3835C31.2129 39.2158 31.3511 39.074 31.5162 38.9697L36.5496 35.0642C36.6914 34.9306 36.8627 34.8322 37.0497 34.777C37.2366 34.7218 37.4339 34.7113 37.6256 34.7464C37.8174 34.7814 37.9982 34.861 38.1534 34.9788C38.3087 35.0966 38.4341 35.2492 38.5194 35.4243L41.4151 40.8883C41.5964 41.2809 41.641 41.7227 41.5419 42.1435C41.4428 42.5643 41.2057 42.9399 40.8683 43.2105L38.3827 45.1602C38.0396 45.4223 37.6181 45.5612 37.1862 45.5545C36.7544 45.5477 36.3374 45.3957 36.0027 45.1229L31.3795 40.969Z'
            fill='#63697E'
        />
        <path
            d='M40.6825 31.6182C40.4892 31.6333 40.295 31.603 40.1155 31.5297C39.936 31.4565 39.7762 31.3423 39.6488 31.1963C39.5214 31.0503 39.43 30.8765 39.3818 30.6888C39.3336 30.5012 39.33 30.3049 39.3713 30.1156L40.1605 23.7885C40.1674 23.5946 40.2197 23.4049 40.3132 23.2348C40.4067 23.0647 40.5388 22.9189 40.6989 22.809C40.859 22.6991 41.0427 22.6283 41.2351 22.6021C41.4276 22.576 41.6235 22.5953 41.8072 22.6585L47.7292 24.4777C48.1337 24.6267 48.4762 24.9074 48.7016 25.2746C48.9271 25.6418 49.0223 26.0741 48.972 26.5019L48.5743 29.6623C48.5162 30.0904 48.3153 30.4863 48.004 30.786C47.6928 31.0857 47.2894 31.2717 46.8592 31.3139L40.6825 31.6182Z'
            fill='#63697E'
        />
        <path
            d='M40.6513 18.4366C40.5258 18.5862 40.3669 18.7041 40.1873 18.7809C40.0078 18.8576 39.8126 18.891 39.6177 18.8783C39.4228 18.8656 39.2337 18.8072 39.0656 18.7078C38.8975 18.6084 38.7553 18.4708 38.6504 18.3062L34.7417 13.2706C34.608 13.1289 34.5095 12.9577 34.4543 12.7709C34.399 12.5841 34.3885 12.387 34.4236 12.1954C34.4587 12.0038 34.5384 11.8231 34.6563 11.668C34.7741 11.5128 34.9269 11.3876 35.1022 11.3023L40.5705 8.4089C40.964 8.2285 41.4067 8.1849 41.8278 8.28505C42.249 8.3852 42.6245 8.62334 42.8945 8.96152L44.8457 11.4762C45.1081 11.819 45.2472 12.2402 45.2404 12.6717C45.2336 13.1032 45.0815 13.5198 44.8085 13.8543L40.6513 18.4366Z'
            fill='#63697E'
        />
        <path
            d='M31.2986 9.14144C31.315 9.33572 31.2854 9.53111 31.2122 9.71183C31.139 9.89256 31.0243 10.0535 30.8772 10.1817C30.7302 10.3099 30.555 10.4017 30.3659 10.4496C30.1768 10.4976 29.979 10.5004 29.7886 10.4578L23.4626 9.66298C23.268 9.65704 23.0775 9.60549 22.9065 9.51246C22.7354 9.41943 22.5886 9.28754 22.478 9.12742C22.3673 8.96731 22.2958 8.78342 22.2694 8.59065C22.2429 8.39787 22.2621 8.20159 22.3255 8.0176L24.1462 2.10655C24.2944 1.70173 24.5751 1.3588 24.9428 1.13339C25.3105 0.907978 25.7437 0.813313 26.172 0.864734L29.335 1.25591C29.7629 1.315 30.1585 1.51607 30.4583 1.82687C30.7581 2.13766 30.9446 2.54015 30.9879 2.96962L31.2986 9.14144Z'
            fill='#63697E'
        />
        <path
            d='M18.1004 9.17876C18.2489 9.30417 18.3658 9.46262 18.4418 9.64141C18.5179 9.8202 18.5509 10.0143 18.5382 10.2082C18.5255 10.402 18.4675 10.5902 18.3688 10.7576C18.2701 10.925 18.1334 11.0668 17.9699 11.1718L12.9303 15.0836C12.7884 15.2172 12.6171 15.3156 12.4302 15.3708C12.2432 15.426 12.0459 15.4365 11.8542 15.4014C11.6624 15.3664 11.4816 15.2868 11.3264 15.169C11.1711 15.0512 11.0457 14.8986 10.9604 14.7235L8.0647 9.25326C7.88461 8.86099 7.84119 8.41975 7.94143 7.99997C8.04168 7.58018 8.27982 7.20602 8.61776 6.93725L11.1034 4.98142C11.4472 4.72013 11.869 4.58228 12.3009 4.59016C12.7328 4.59805 13.1493 4.75122 13.4833 5.02488L18.1004 9.17876Z'
            fill='#63697E'
        />
        <path
            d='M27.9991 36.9148C25.6549 37.5588 23.1722 37.4938 20.8651 36.7278C18.5579 35.9619 16.5299 34.5295 15.0375 32.6119C13.5451 30.6942 12.6553 28.3773 12.4808 25.9544C12.3063 23.5314 12.8548 21.1112 14.057 18.9997C15.2592 16.8883 17.061 15.1805 19.2346 14.0923C21.4082 13.0041 23.856 12.5844 26.2683 12.8864C28.6806 13.1883 30.9491 14.1983 32.787 15.7886C34.6248 17.3789 35.9493 19.478 36.5931 21.8205C37.4544 24.9608 37.0332 28.3143 35.4218 31.1445C33.8104 33.9746 31.1407 36.05 27.9991 36.9148ZM19.5729 6.26681C15.8502 7.28654 12.5137 9.38628 9.98523 12.3006C7.45678 15.2149 5.84984 18.8128 5.36771 22.6396C4.88558 26.4663 5.54985 30.35 7.27653 33.7995C9.0032 37.2491 11.7148 40.1096 15.0684 42.0195C18.4219 43.9293 22.2669 44.8027 26.1173 44.5292C29.9676 44.2557 33.6503 42.8476 36.6997 40.4829C39.7492 38.1183 42.0285 34.9032 43.2494 31.2443C44.4704 27.5854 44.5781 23.6469 43.5591 19.9268C42.1906 14.9375 38.8949 10.6955 34.3968 8.1339C29.8986 5.57225 24.5665 4.90066 19.5729 6.26681Z'
            fill='#63697E'
        />
        <path
            d='M26.2968 30.6622C25.1934 30.9654 24.0247 30.9347 22.9387 30.5742C21.8528 30.2136 20.8982 29.5394 20.1958 28.6367C19.4934 27.734 19.0747 26.6434 18.9926 25.5029C18.9106 24.3624 19.1689 23.2232 19.7348 22.2294C20.3008 21.2356 21.149 20.4318 22.1722 19.9198C23.1954 19.4077 24.3476 19.2104 25.4831 19.3527C26.6185 19.4951 27.6863 19.9707 28.5512 20.7194C29.4161 21.4681 30.0394 22.4563 30.3421 23.559C30.5439 24.2908 30.5993 25.0552 30.5051 25.8084C30.411 26.5617 30.1691 27.2889 29.7934 27.9487C29.4177 28.6084 28.9154 29.1877 28.3154 29.6533C27.7154 30.1189 27.0295 30.4617 26.2968 30.6622ZM20.7041 10.4454C17.8071 11.237 15.2102 12.8694 13.2419 15.136C11.2736 17.4027 10.0224 20.2018 9.64665 23.1791C9.27087 26.1565 9.78738 29.1784 11.1308 31.8623C12.4743 34.5463 14.5843 36.7718 17.1939 38.2573C19.8036 39.7427 22.7955 40.4213 25.7912 40.2072C28.7869 39.9931 31.6518 38.896 34.0233 37.0546C36.3948 35.2132 38.1663 32.7103 39.1138 29.8626C40.0614 27.0149 40.1423 23.9504 39.3463 21.0568C38.2786 17.1819 35.7162 13.8885 32.2213 11.8991C28.7263 9.90975 24.5844 9.38697 20.7041 10.4454Z'
            fill='#A4A9B7'
        />
        <path
            d='M26.2968 30.6621C25.1934 30.9653 24.0247 30.9346 22.9387 30.5741C21.8528 30.2135 20.8983 29.5393 20.1958 28.6366C19.4934 27.7339 19.0747 26.6433 18.9926 25.5028C18.9106 24.3623 19.1689 23.2231 19.7349 22.2293C20.3008 21.2355 21.149 20.4317 22.1722 19.9197C23.1954 19.4076 24.3476 19.2103 25.4831 19.3526C26.6185 19.495 27.6863 19.9706 28.5512 20.7193C29.4161 21.468 30.0394 22.4562 30.3421 23.5589C30.5439 24.2907 30.5993 25.0551 30.5051 25.8084C30.411 26.5616 30.1691 27.2889 29.7934 27.9486C29.4177 28.6083 28.9154 29.1876 28.3154 29.6532C27.7154 30.1188 27.0295 30.4617 26.2968 30.6621ZM21.7046 13.9473C19.4993 14.5538 17.5235 15.8001 16.0271 17.5286C14.5307 19.2572 13.5809 21.3904 13.2979 23.6583C13.0148 25.9262 13.4112 28.2271 14.437 30.2699C15.4627 32.3127 17.0717 34.0057 19.0604 35.1347C21.0492 36.2638 23.3283 36.7782 25.6097 36.6129C27.891 36.4476 30.0721 35.6101 31.877 34.2061C33.6819 32.8022 35.0296 30.895 35.7497 28.7257C36.4698 26.5564 36.5298 24.2225 35.9223 22.0191C35.5205 20.5524 34.833 19.1794 33.8993 17.9786C32.9655 16.7778 31.8039 15.7729 30.4809 15.0214C29.1579 14.2698 27.6995 13.7865 26.1892 13.599C24.679 13.4115 23.1465 13.5235 21.6797 13.9286L21.7046 13.9473Z'
            fill='#63697E'
        />
        <path
            d='M43.3668 45.6754C43.5118 45.6658 43.6571 45.6898 43.7913 45.7454C43.9255 45.801 44.045 45.8869 44.1406 45.9962C44.2362 46.1055 44.3053 46.2354 44.3425 46.3758C44.3797 46.5161 44.3839 46.6632 44.3549 46.8055L43.7335 51.543C43.7263 51.6887 43.6856 51.8308 43.6146 51.9583C43.5435 52.0858 43.444 52.1952 43.3238 52.2781C43.2036 52.361 43.066 52.415 42.9215 52.4362C42.777 52.4573 42.6296 52.4449 42.4907 52.3999L38.0476 51.0338C37.7439 50.9217 37.4867 50.7107 37.3176 50.4347C37.1485 50.1588 37.0773 49.8339 37.1155 49.5126L37.4076 47.1407C37.4508 46.8193 37.6013 46.5218 37.8347 46.2964C38.0682 46.0711 38.3708 45.931 38.6939 45.8989L43.3668 45.6754Z'
            fill='#63697E'
        />
        <path
            d='M43.3976 55.5605C43.4939 55.4524 43.6136 55.3678 43.7476 55.313C43.8815 55.2582 44.0263 55.2347 44.1707 55.2443C44.3152 55.2539 44.4556 55.2963 44.5811 55.3683C44.7067 55.4403 44.8141 55.54 44.8952 55.6599L47.8283 59.435C47.925 59.5431 47.9958 59.672 48.035 59.8117C48.0742 59.9514 48.0808 60.0982 48.0544 60.2409C48.028 60.3835 47.9692 60.5183 47.8826 60.6347C47.796 60.7512 47.6839 60.8463 47.5548 60.9127L43.4535 63.0859C43.1593 63.2209 42.8283 63.254 42.5131 63.1797C42.1979 63.1055 41.9166 62.9282 41.7136 62.6761L40.2471 60.8134C40.0465 60.5584 39.9375 60.2436 39.9375 59.9193C39.9375 59.595 40.0465 59.2801 40.2471 59.0252L43.3976 55.5605Z'
            fill='#63697E'
        />
        <path
            d='M50.4137 62.5331C50.4053 62.3886 50.4301 62.244 50.4862 62.1105C50.5423 61.9771 50.6282 61.8581 50.7373 61.7629C50.8464 61.6676 50.9759 61.5986 51.1158 61.561C51.2557 61.5233 51.4024 61.5182 51.5446 61.5458L56.286 62.1667C56.4318 62.1739 56.5741 62.2146 56.7016 62.2856C56.8292 62.3566 56.9387 62.456 57.0216 62.5761C57.1045 62.6962 57.1587 62.8337 57.1798 62.9781C57.201 63.1225 57.1885 63.2698 57.1435 63.4086L55.7764 67.8419C55.6634 68.1453 55.4523 68.4023 55.1765 68.5722C54.9007 68.742 54.576 68.815 54.2539 68.7794L51.8802 68.4814C51.5585 68.4382 51.2607 68.2879 51.0352 68.0546C50.8096 67.8214 50.6695 67.5189 50.6374 67.1961L50.4137 62.5331Z'
            fill='#63697E'
        />
        <path
            d='M60.3059 62.5086C60.1977 62.4124 60.113 62.2928 60.0582 62.1589C60.0033 62.0251 59.9798 61.8805 59.9894 61.7361C59.999 61.5918 60.0414 61.4515 60.1135 61.3261C60.1856 61.2006 60.2854 61.0933 60.4053 61.0122L64.1834 58.0753C64.2917 57.9786 64.4207 57.9079 64.5605 57.8688C64.7003 57.8296 64.8472 57.823 64.99 57.8493C65.1328 57.8757 65.2676 57.9344 65.3842 58.0209C65.5008 58.1075 65.5959 58.2195 65.6624 58.3485L67.8311 62.4465C67.9684 62.7401 68.0027 63.0715 67.9282 63.387C67.8538 63.7024 67.6751 63.9836 67.421 64.185L65.5568 65.6566C65.2983 65.8501 64.9826 65.952 64.6597 65.9464C64.3368 65.9408 64.0249 65.8279 63.7733 65.6255L60.3059 62.5086Z'
            fill='#63697E'
        />
        <path
            d='M67.3093 55.4982C67.1646 55.5065 67.02 55.4817 66.8864 55.4257C66.7528 55.3696 66.6338 55.2838 66.5384 55.1748C66.4431 55.0658 66.374 54.9364 66.3364 54.7966C66.2987 54.6568 66.2936 54.5102 66.3213 54.3681L66.9427 49.6244C66.9495 49.4787 66.9901 49.3366 67.0611 49.2093C67.1322 49.0819 67.2319 48.9727 67.3524 48.8903C67.4728 48.8079 67.6107 48.7544 67.7552 48.7342C67.8998 48.714 68.047 48.7275 68.1855 48.7737L72.6223 50.1397C72.9261 50.2505 73.1837 50.4601 73.3539 50.7349C73.5241 51.0097 73.597 51.3337 73.5606 51.6548L73.2623 54.0266C73.2191 54.3481 73.0687 54.6456 72.8352 54.8709C72.6018 55.0963 72.299 55.2364 71.976 55.2684L67.3093 55.4982Z'
            fill='#63697E'
        />
        <path
            d='M67.2599 45.6133C67.1632 45.7211 67.0431 45.8053 66.9088 45.8596C66.7746 45.9139 66.6297 45.9368 66.4853 45.9266C66.3408 45.9165 66.2006 45.8734 66.0753 45.8008C65.95 45.7282 65.8429 45.628 65.7623 45.5078L62.823 41.7327C62.7263 41.6251 62.6555 41.4967 62.6163 41.3574C62.5771 41.2182 62.5705 41.0718 62.5969 40.9296C62.6234 40.7874 62.6821 40.6531 62.7687 40.5372C62.8554 40.4213 62.9675 40.3268 63.0964 40.2611L67.1977 38.0879C67.4924 37.9525 67.8241 37.9198 68.1397 37.9953C68.4552 38.0707 68.7362 38.2499 68.9377 38.5039L70.4042 40.3667C70.6037 40.6221 70.7121 40.9368 70.7121 41.2608C70.7121 41.5848 70.6037 41.8995 70.4042 42.1549L67.2599 45.6133Z'
            fill='#63697E'
        />
        <path
            d='M60.244 38.6408C60.2524 38.7854 60.2275 38.9299 60.1714 39.0634C60.1153 39.1969 60.0295 39.3158 59.9204 39.4111C59.8112 39.5063 59.6818 39.5754 59.5419 39.613C59.402 39.6506 59.2553 39.6558 59.1131 39.6281L54.3656 39.0072C54.2202 38.9991 54.0787 38.9578 53.9519 38.8864C53.8251 38.815 53.7164 38.7155 53.6342 38.5956C53.5519 38.4756 53.4983 38.3383 53.4775 38.1944C53.4567 38.0505 53.4693 37.9037 53.5142 37.7654L54.8813 33.3321C54.9893 33.0266 55.1985 32.7671 55.4743 32.5966C55.75 32.4261 56.0757 32.3548 56.3975 32.3945L58.7713 32.6926C59.0921 32.7355 59.3891 32.8849 59.6145 33.1169C59.8399 33.3489 59.9807 33.65 60.0141 33.9716L60.244 38.6408Z'
            fill='#63697E'
        />
        <path
            d='M50.3453 38.6654C50.4546 38.7609 50.5404 38.8803 50.596 39.0143C50.6515 39.1483 50.6754 39.2933 50.6658 39.4381C50.6562 39.5828 50.6133 39.7234 50.5405 39.8489C50.4677 39.9744 50.3669 40.0815 50.246 40.1617L46.4678 43.0924C46.3605 43.1893 46.2324 43.2603 46.0934 43.3C45.9543 43.3396 45.808 43.3468 45.6657 43.321C45.5234 43.2952 45.3889 43.2371 45.2727 43.1512C45.1564 43.0653 45.0614 42.9538 44.995 42.8254L42.8201 38.7212C42.685 38.4272 42.652 38.0965 42.7263 37.7816C42.8006 37.4666 42.9779 37.1855 43.2303 36.9827L45.0945 35.5174C45.3496 35.3169 45.6647 35.208 45.9893 35.208C46.3138 35.208 46.629 35.3169 46.8841 35.5174L50.3453 38.6654Z'
            fill='#63697E'
        />
        <path
            d='M57.7712 59.4662C56.014 59.9512 54.1524 59.9045 52.4217 59.332C50.6911 58.7596 49.1692 57.6872 48.0487 56.2504C46.9281 54.8135 46.2592 53.0769 46.1267 51.2602C45.9941 49.4435 46.4037 47.6283 47.3038 46.0443C48.2038 44.4602 49.5539 43.1785 51.1831 42.3612C52.8123 41.544 54.6475 41.2279 56.4565 41.453C58.2655 41.6781 59.9671 42.4343 61.346 43.6258C62.7248 44.8174 63.719 46.3908 64.2028 48.147C64.8492 50.5001 64.5351 53.0134 63.3294 55.1354C62.1236 57.2574 60.1248 58.8149 57.7712 59.4662ZM51.4515 36.4926C48.6639 37.2643 46.1677 38.8442 44.2782 41.0326C42.3887 43.2211 41.1906 45.92 40.8354 48.7884C40.4802 51.6569 40.9837 54.5662 42.2823 57.1489C43.581 59.7315 45.6164 61.8717 48.1317 63.299C50.647 64.7264 53.5293 65.3769 56.4143 65.1684C59.2994 64.9599 62.058 63.9018 64.3416 62.1276C66.6251 60.3535 68.3312 57.9429 69.2444 55.2004C70.1576 52.4579 70.2369 49.5065 69.4723 46.7189C68.9648 44.8627 68.0955 43.125 66.9142 41.6053C65.7329 40.0856 64.263 38.8138 62.5887 37.8631C60.9144 36.9124 59.0687 36.3014 57.1575 36.0652C55.2463 35.8289 53.3072 35.9721 51.4515 36.4864V36.4926Z'
            fill='#63697E'
        />
        <path
            d='M56.4784 54.7658C55.6485 54.9964 54.7688 54.9755 53.9508 54.7059C53.1327 54.4363 52.4132 53.93 51.8834 53.2514C51.3536 52.5727 51.0375 51.7521 50.975 50.8937C50.9125 50.0353 51.1064 49.1776 51.5323 48.4295C51.9581 47.6813 52.5967 47.0764 53.3671 46.6913C54.1374 46.3061 55.0049 46.1582 55.8594 46.2663C56.714 46.3744 57.5173 46.7335 58.1673 47.2983C58.8174 47.863 59.285 48.6078 59.5109 49.4384C59.8123 50.5466 59.6625 51.7289 59.0943 52.7271C58.5262 53.7253 57.5857 54.4582 56.4784 54.7658ZM52.315 39.6157C50.1434 40.2105 48.1971 41.4354 46.7223 43.1355C45.2475 44.8356 44.3103 46.9346 44.0294 49.1669C43.7485 51.3992 44.1364 53.6647 45.1441 55.6767C46.1518 57.6887 47.734 59.3569 49.6907 60.4704C51.6473 61.5839 53.8905 62.0925 56.1364 61.9321C58.3824 61.7716 60.5304 60.9493 62.3085 59.569C64.0867 58.1887 65.4153 56.3125 66.1263 54.1777C66.8373 52.0429 66.8987 49.7454 66.3028 47.5757C65.504 44.667 63.5816 42.1943 60.9585 40.7016C58.3354 39.2089 55.2263 38.8183 52.315 39.6157Z'
            fill='#A4A9B7'
        />
        <path
            d='M56.478 54.7657C55.6481 54.9962 54.7684 54.9754 53.9503 54.7058C53.1323 54.4362 52.4128 53.9299 51.883 53.2513C51.3532 52.5726 51.0371 51.752 50.9745 50.8936C50.912 50.0352 51.106 49.1775 51.5318 48.4294C51.9577 47.6812 52.5963 47.0762 53.3666 46.6911C54.137 46.306 55.0044 46.1581 55.859 46.2662C56.7136 46.3743 57.5168 46.7334 58.1669 47.2981C58.817 47.8629 59.2845 48.6077 59.5104 49.4383C59.8118 50.5465 59.6621 51.7288 59.0939 52.727C58.5257 53.7252 57.5853 54.4581 56.478 54.7657ZM53.0168 42.2296C51.3543 42.681 49.8634 43.6155 48.733 44.9146C47.6027 46.2137 46.8838 47.8188 46.6675 49.5266C46.4512 51.2344 46.7472 52.9679 47.518 54.5074C48.2889 56.0468 49.4998 57.323 50.9973 58.1741C52.4948 59.0251 54.2115 59.4128 55.9297 59.2878C57.6479 59.1629 59.2904 58.531 60.6488 57.4723C62.0072 56.4136 63.0205 54.9757 63.5602 53.341C64.0998 51.7062 64.1416 49.9481 63.6801 48.2896C63.0644 46.0769 61.5973 44.1975 59.5993 43.062C57.6014 41.9265 55.2349 41.6272 53.0168 42.2296Z'
            fill='#63697E'
        />
    </Svg>

);

export default Gears;
